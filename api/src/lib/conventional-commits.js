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

import * as semver from 'semver';
import {Readable} from 'stream';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const concat = require('concat-stream');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const conventionalCommitsFilter = require('conventional-commits-filter');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const conventionalCommitsParser = require('conventional-commits-parser');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const conventionalChangelogWriter = require('conventional-changelog-writer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const parseGithubRepoUrl = require('parse-github-repo-url');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const presetFactory = require('conventional-changelog-conventionalcommits');

// Perform some post processing on the commits parsed by conventional commits:
// 1. don't allow BREAKING CHANGES to have two newlines:
import {Transform} from 'stream';

class PostProcessCommits extends Transform {
  _transform(
    chunk,
    _encoding,
    done
  ) {
    chunk.notes.forEach(note => {
      note.text = note.text.split(/\r?\n/)[0];
    });
    this.push(JSON.stringify(chunk, null, 4) + '\n');
    done();
  }
}

export class ConventionalCommits {
  constructor(options) {
    const parsedGithubRepoUrl = parseGithubRepoUrl(options.githubRepoUrl);
    if (!parsedGithubRepoUrl) throw Error('could not parse githubRepoUrl');
    const [owner, repository] = parsedGithubRepoUrl;
    this.commits = options.commits;
    this.bumpMinorPreMajor = options.bumpMinorPreMajor || false;
    this.host = options.host || 'https://www.github.com';
    this.owner = owner;
    this.repository = repository;
    // we allow some languages (currently Ruby) to provide their own
    // template style:
    this.commitPartial = options.commitPartial;
    this.headerPartial = options.headerPartial;
    this.mainTemplate = options.mainTemplate;
    this.changelogSections = options.changelogSections;
  }
  async suggestBump(version) {
    const preMajor = this.bumpMinorPreMajor
      ? semver.lt(version, 'v1.0.0')
      : false;
    const bump = await this.guessReleaseType(preMajor);
    return bump;
  }
  async generateChangelogEntry(
    options
  ) {
    const context = {
      host: this.host,
      owner: this.owner,
      repository: this.repository,
      version: options.version,
      previousTag: options.previousTag,
      currentTag: options.currentTag,
      linkCompare: !!options.previousTag,
    };

    // allows the sections displayed in the CHANGELOG to be configured
    // as an example, Ruby displays docs:
    const config = {};
    if (this.changelogSections) {
      config.types = this.changelogSections;
    }

    const preset = await presetFactory(config);
    preset.writerOpts.commitPartial =
      this.commitPartial || preset.writerOpts.commitPartial;
    preset.writerOpts.headerPartial =
      this.headerPartial || preset.writerOpts.headerPartial;
    preset.writerOpts.mainTemplate =
      this.mainTemplate || preset.writerOpts.mainTemplate;

    return new Promise((resolve, reject) => {
      let content = '';
      const stream = this.commitsReadable()
        .pipe(conventionalCommitsParser(preset.parserOpts))
        .pipe(new PostProcessCommits({objectMode: true}))
        .pipe(conventionalChangelogWriter(context, preset.writerOpts));

      stream.on('error', (err) => {
        return reject(err);
      });

      stream.on('data', (buffer) => {
        content += buffer.toString('utf8');
      });

      stream.on('end', () => {
        return resolve(content.trim());
      });
    });
  }
  async guessReleaseType(preMajor) {
    const VERSIONS = ['major', 'minor', 'patch'];
    const preset = await presetFactory({preMajor});
    return new Promise((resolve, reject) => {
      const stream = this.commitsReadable()
        .pipe(conventionalCommitsParser(preset.parserOpts))
        .pipe(
          concat((data) => {
            const commits = conventionalCommitsFilter(data);

            let result = preset.recommendedBumpOpts.whatBump(
              commits,
              preset.recommendedBumpOpts
            );

            if (result && result.level !== null) {
              result.releaseType = VERSIONS[result.level];
            } else if (result === null) {
              result = {};
            }

            // we have slightly different logic than the default of conventional commits,
            // the minor should be bumped when features are introduced for pre 1.x.x libs:
            if (
              result.reason.indexOf(' 0 features') === -1 &&
              result.releaseType === 'patch'
            ) {
              result.releaseType = 'minor';
            }

            return resolve(result);
          })
        );

      stream.on('error', (err) => {
        return reject(err);
      });
    });
  }
  commitsReadable() {
    // The conventional commits parser expects an array of string commit
    // messages terminated by `-hash-` followed by the commit sha. We
    // piggyback off of this, and use this sha when choosing a
    // point to branch from for PRs.
    const commitsReadable = new Readable();
    this.commits.forEach((commit) => {
      commitsReadable.push(
        `${commit.message}\n-hash-\n${commit.sha ? commit.sha : ''}`
      );
    });
    commitsReadable.push(null);
    return commitsReadable;
  }
}
