import {ConventionalCommits} from '../../lib/conventional-commits'
import {GitHub} from '../../lib/github'
import * as semver from 'semver'

export const changelogs = () => {
  return [];
}

export const createChangelog = async ({ input }) => {
  const [owner, repo] = input.repository.split('/')
  const defaultBranch = input.branch ? input.branch : undefined;
  const github = new GitHub({
    token: process.env.GITHUB_TOKEN,
    owner,
    repo,
    defaultBranch
  })

  const latestTag = await github.latestTag(undefined, false, input.shas);
  let sha = latestTag ? latestTag.sha : input.shas
  if (input.shas && latestTag) {
    sha = latestTag.sha;
  }
  // If we fail to find a sha, don't try to generate a CHANGELOG:
  if (!sha || sha.match(/\./)) {
    throw Error('could not find sha');
  }

  const commits = await github.commitsSinceSha(sha, 100);
  const cc = new ConventionalCommits({
    commits,
    githubRepoUrl: `https://github.com/${input.repository}`,
    bumpMinorPreMajor: true,
    // changelogSections: this.changelogSections,
  });
  const candidate = await coerceReleaseCandidate(cc, latestTag);
  const markdown = await cc.generateChangelogEntry({
    version: candidate.version,
    currentTag: `v${candidate.version}`,
    previousTag: candidate.previousTag,
  });
  return { shas: input.shas, markdown }
}

async function coerceReleaseCandidate(cc, latestTag, preRelease = false) {
  const releaseAsRe = /release-as:\s*v?([0-9]+\.[0-9]+\.[0-9a-z]+(-[0-9a-z.]+)?)\s*/i;
  const previousTag = latestTag ? latestTag.name : undefined;
  let version = latestTag ? latestTag.version : '1.0.0';

  // If a commit contains the footer release-as: 1.x.x, we use this version
  // from the commit footer rather than the version returned by suggestBump().
  const releaseAsCommit = cc.commits.find((element) => {
    if (element.message.match(releaseAsRe)) {
      return true;
    } else {
      return false;
    }
  });

  if (releaseAsCommit) {
    const match = releaseAsCommit.message.match(releaseAsRe);
    version = match[1];
  } else if (preRelease) {
    // Handle pre-release format v1.0.0-alpha1, alpha2, etc.
    const [prefix, suffix] = version.split('-');
    const match = suffix?.match(/(?<type>[^0-9]+)(?<number>[0-9]+)/);
    const number = Number(match?.groups?.number || 0) + 1;
    version = `${prefix}-${match?.groups?.type || 'alpha'}${number}`;
  } else if (latestTag) {
    const bump = await cc.suggestBump(version);
    const candidate = semver.inc(version, bump.releaseType);
    if (!candidate) throw Error(`failed to increment ${version}`);
    version = candidate;
  }

  return {version, previousTag};
}