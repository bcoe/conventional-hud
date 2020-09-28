// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Octokit} from '@octokit/rest';
import {request} from '@octokit/request';
import {graphql} from '@octokit/graphql';
import * as semver from 'semver';

import { graphqlToCommits } from './graphql-to-commits';

const VERSION_FROM_BRANCH_RE = /^.*:[^-]+-(.*)$/;

let probotMode = false;

export class GitHub {
  constructor(options) {
    this.defaultBranch = options.defaultBranch;
    this.token = options.token;
    this.owner = options.owner;
    this.repo = options.repo;
    this.apiUrl = options.apiUrl || 'https://api.github.com';
    this.proxyKey = options.proxyKey;

    if (options.octokitAPIs === undefined) {
      this.octokit = new Octokit({
        baseUrl: options.apiUrl,
        auth: this.token,
      });
      const defaults = {
        baseUrl: this.apiUrl,
        headers: {
          'user-agent': `release-please/${
            require('../../package.json').version
          }`,
          // some proxies do not require the token prefix.
          Authorization: `${this.proxyKey ? '' : 'token '}${this.token}`,
        },
      };
      this.request = request.defaults(defaults);
      this.graphql = graphql;
    } else {
      // for the benefit of probot applications, we allow a configured instance
      // of octokit to be passed in as a parameter.
      probotMode = true;
      this.octokit = options.octokitAPIs.octokit;
      this.request = options.octokitAPIs.request;
      this.graphql = options.octokitAPIs.graphql;
    }
  }

  async graphqlRequest(_opts) {
    let opts = Object.assign({}, _opts);
    if (!probotMode) {
      opts = Object.assign(opts, {
        url: `${this.apiUrl}/graphql${
          this.proxyKey ? `?key=${this.proxyKey}` : ''
        }`,
        headers: {
          authorization: `${this.proxyKey ? '' : 'token '}${this.token}`,
          'content-type': 'application/vnd.github.v3+json',
        },
      });
    }
    return this.graphql(opts);
  }

  decoratePaginateOpts(opts) {
    if (probotMode) {
      return opts;
    } else {
      return Object.assign(opts, {
        headers: {
          Authorization: `${this.proxyKey ? '' : 'token '}${this.token}`,
        },
      });
    }
  }

  async commitsSinceSha(
    sha,
    perPage = 100,
    labels = false,
    path = null
  ) {
    const commits = [];
    const method = labels ? 'commitsWithLabels' : 'commitsWithFiles';

    let cursor;
    for (;;) {
      const commitsResponse = await this[method](
        cursor,
        perPage,
        path
      );
      for (let i = 0, commit; i < commitsResponse.commits.length; i++) {
        commit = commitsResponse.commits[i];
        if (commit.sha === sha) {
          return commits;
        } else {
          commits.push(commit);
        }
      }
      if (commitsResponse.hasNextPage === false || !commitsResponse.endCursor) {
        return commits;
      } else {
        cursor = commitsResponse.endCursor;
      }
    }
  }

  async commitsWithFiles(
    cursor = undefined,
    perPage = 32,
    path = null,
    maxFilesChanged = 64,
    retries = 0
  ) {
    // The GitHub v3 API does not offer an elegant way to fetch commits
    // in conjucntion with the path that they modify. We lean on the graphql
    // API for this one task, fetching commits in descending chronological
    // order along with the file paths attached to them.
    try {
      const response = await this.graphqlRequest({
        query: `query commitsWithFiles($cursor: String, $owner: String!, $repo: String!, $perPage: Int, $maxFilesChanged: Int, $path: String) {
          repository(owner: $owner, name: $repo) {
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: $perPage, after: $cursor, path: $path) {
                    edges{
                      node {
                        ... on Commit {
                          message
                          oid
                          associatedPullRequests(first: 1) {
                            edges {
                              node {
                                ... on PullRequest {
                                  number
                                  mergeCommit {
                                    oid
                                  }
                                  files(first: $maxFilesChanged) {
                                    edges {
                                      node {
                                        path
                                      }
                                    }
                                    pageInfo {
                                      endCursor
                                      hasNextPage
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    pageInfo {
                      endCursor
                      hasNextPage
                    }
                  }
                }
              }
            }
          }
        }`,
        cursor,
        maxFilesChanged,
        owner: this.owner,
        path,
        perPage,
        repo: this.repo,
      });
      return graphqlToCommits(this, response);
    } catch (err) {
      if (err.status === 502 && retries < 3) {
        // GraphQL sometimes returns a 502 on the first request,
        // this seems to relate to a cache being warmed and the
        // second request generally works.
        return this.commitsWithFiles(
          cursor,
          perPage,
          path,
          maxFilesChanged,
          retries++
        );
      } else {
        throw err;
      }
    }
  }

  async commitsWithLabels(
    cursor = undefined,
    perPage = 32,
    path = null,
    maxLabels = 16,
    retries = 0
  ) {
    try {
      const response = await this.graphqlRequest({
        query: `query commitsWithLabels($cursor: String, $owner: String!, $repo: String!, $perPage: Int, $maxLabels: Int, $path: String) {
          repository(owner: $owner, name: $repo) {
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: $perPage, after: $cursor, path: $path) {
                    edges{
                      node {
                        ... on Commit {
                          message
                          oid
                          associatedPullRequests(first: 1) {
                            edges {
                              node {
                                ... on PullRequest {
                                  number
                                  mergeCommit {
                                    oid
                                  }
                                  labels(first: $maxLabels) {
                                    edges {
                                      node {
                                        name
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    pageInfo {
                      endCursor
                      hasNextPage
                    }
                  }
                }
              }
            }
          }
        }`,
        cursor,
        maxLabels,
        owner: this.owner,
        path,
        perPage,
        repo: this.repo,
      });
      return graphqlToCommits(this, response);
    } catch (err) {
      if (err.status === 502 && retries < 3) {
        // GraphQL sometimes returns a 502 on the first request,
        // this seems to relate to a cache being warmed and the
        // second request generally works.
        return this.commitsWithLabels(
          cursor,
          perPage,
          path,
          maxLabels,
          retries++
        );
      } else {
        throw err;
      }
    }
  }

  async pullRequestFiles(
    num,
    cursor,
    maxFilesChanged = 100
  ) {
    // Used to handle the edge-case in which a PR has more than 100
    // modified files attached to it.
    const response = await this.graphqlRequest({
      query: `query pullRequestFiles($cursor: String, $owner: String!, $repo: String!, $maxFilesChanged: Int, $num: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $num) {
              number
              files(first: $maxFilesChanged, after: $cursor) {
                edges {
                  node {
                    path
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }`,
      cursor,
      maxFilesChanged,
      owner: this.owner,
      repo: this.repo,
      num,
    });
    return {node: response.repository.pullRequest};
  }

  async getTagSha(name) {
    const refResponse = (await this.request(
      `GET /repos/:owner/:repo/git/refs/tags/:name${
        this.proxyKey ? `?key=${this.proxyKey}` : ''
      }`,
      {
        owner: this.owner,
        repo: this.repo,
        name,
      }
    ));
    return refResponse.data.object.sha;
  }

  async latestTag(
    prefix,
    preRelease = false,
    filter
  ) {
    const tags = await this.allTags(prefix);
    const versions = Object.keys(tags).filter(t => {
      // remove any pre-releases from the list:
      return preRelease || !t.includes('-');
    });
    // no tags have been created yet.
    if (versions.length === 0) return undefined;
    if (filter) {
      filter = filter.replace(/^v/, '')
      if (tags[filter]) {
        return {
          name: tags[filter].name,
          sha: tags[filter].sha,
          version: tags[filter].version,
        };
      } else {
        return undefined
      }
    }

    // We use a slightly modified version of semver's sorting algorithm, which
    // prefixes the numeric part of a pre-release with '0's, so that
    // 010 is greater than > 002.
    versions.sort((v1, v2) => {
      if (v1.includes('-')) {
        const [prefix, suffix] = v1.split('-');
        v1 = prefix + '-' + suffix.replace(/[a-zA-Z.]/, '').padStart(6, '0');
      }
      if (v2.includes('-')) {
        const [prefix, suffix] = v2.split('-');
        v2 = prefix + '-' + suffix.replace(/[a-zA-Z.]/, '').padStart(6, '0');
      }
      return semver.rcompare(v1, v2);
    });
    return {
      name: tags[versions[0]].name,
      sha: tags[versions[0]].sha,
      version: tags[versions[0]].version,
    };
  }

  async findMergedReleasePR(
    label,
    perPage = 100
  ) {
    const pullsResponse = (await this.request(
      `GET /repos/:owner/:repo/pulls?state=closed&per_page=${perPage}${
        this.proxyKey ? `&key=${this.proxyKey}` : ''
      }`,
      {
        owner: this.owner,
        repo: this.repo,
      }
    ));
    for (let i = 0, pull; i < pullsResponse.data.length; i++) {
      pull = pullsResponse.data[i];
      if (
        this.hasAllLabels(
          labels,
          pull.labels.map(l => l.name)
        )
      ) {
        // it's expected that a release PR will have a
        // HEAD matching the format repo:release-v1.0.0.
        if (!pull.head) continue;
        const match = pull.head.label.match(VERSION_FROM_BRANCH_RE);
        if (!match || !pull.merged_at) continue;
        return {
          number: pull.number,
          sha: pull.merge_commit_sha,
          version: match[1],
        };
      }
    }
    return undefined;
  }

  hasAllLabels(labelsA, labelsB) {
    let hasAll = true;
    labelsA.forEach(label => {
      if (labelsB.indexOf(label) === -1) hasAll = false;
    });
    return hasAll;
  }

  async allTags(
    prefix
  ) {
    const tags = {};
    for await (const response of this.octokit.paginate.iterator(
      this.decoratePaginateOpts({
        method: 'GET',
        url: `/repos/${this.owner}/${this.repo}/tags?per_page=100${
          this.proxyKey ? `&key=${this.proxyKey}` : ''
        }`,
      })
    )) {
      response.data.forEach((data) => {
        // For monorepos, a prefix can be provided, indicating that only tags
        // matching the prefix should be returned:
        if (prefix && !data.name.startsWith(prefix)) return;
        let version = data.name.replace(prefix, '');
        if ((version = semver.valid(version))) {
          tags[version] = {sha: data.commit.sha, name: data.name, version};
        }
      });
    }
    return tags;
  }

  async getDefaultBranch(owner, repo) {
    if (this.defaultBranch) {
      return this.defaultBranch;
    }
    const {data} = await this.octokit.repos.get({
      repo,
      owner,
      headers: {
        Authorization: `${this.proxyKey ? '' : 'token '}${this.token}`,
      },
    });
    this.defaultBranch = data.default_branch;
    return this.defaultBranch;
  }
}

class AuthError extends Error {
  status;

  constructor() {
    super('unauthorized');
    this.status = 401;
  }
}
