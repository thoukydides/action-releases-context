// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitHub } from '@actions/github/lib/utils';
import * as core from '@actions/core';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { plural } from './utils.js';
import { Release } from './releases.js';
import semver from 'semver';

// GitHub REST API types
type RestRelease = RestEndpointMethodTypes['repos']['listReleases']['response']['data'][0];

// Retrieve releases in the specified repository (excluding drafts/prerelease)
export async function getRepoReleases(github: InstanceType<typeof GitHub>, repository: string): Promise<Release[]> {
    // Retrieve the list of releases
    const releases = await listReleases(github, repository);

    // Exclude drafts and prereleases
    const draftsCount = releases.filter(r => r.draft).length;
    const prereleaseCount = releases.filter(r => r.prerelease).length;
    core.info(`Excluding ${plural(draftsCount, 'draft release')} and ${plural(prereleaseCount, 'prerelease')}`);
    const filtered = releases.filter(r => !r.draft && !r.prerelease);

    // Filter and sort releases by semver, with fallback to dates if no semvers
    let sorted = sortBySemver(filtered);
    if (!sorted.length) sorted = sortByDate(filtered);

    // Convert to a simpler format, without optional properties
    return sorted.map(r => ({
        version:    r.tag_name,
        date:       normaliseDate(r.published_at ?? r.created_at),
        body:       r.body ?? ''
    } satisfies Release));
}

// Retrieve the list of releases
async function listReleases(github: InstanceType<typeof GitHub>, repository: string): Promise<RestRelease[]> {
    // Parse the repository specifier
    const [owner, repo] = repository.split('/', 2);
    if (!owner || !repo) throw new Error(`Invalid repository specifier: ${repository}`);

    // Retrieve the list of releases
    const releases = await github.paginate(github.rest.repos.listReleases, { owner, repo });
    core.info(`Retrieved ${plural(releases.length, 'release')}`);
    core.debug(`REST API Releases:\n${JSON.stringify(releases, null, 4)}`);
    return releases;
}

// Sort releases by semver (descending), omitting any non-semver releases
function sortBySemver(releases: RestRelease[]): RestRelease[] {
    // Select releases with valid semver versions
    const filtered = releases.filter(r => semver.valid(r.tag_name));
    if (!filtered.length) {
        core.info('No releases have semver versions');
        return [];
    }

    // Sort the selected releases (highest semver version first)
    core.info(`Sorting ${filtered.length} of ${plural(releases.length, 'release')} by semver`);
    return filtered.sort((a, b) => semver.rcompare(a.tag_name, b.tag_name));
}

// Sort release by date (descending)
function sortByDate(releases: RestRelease[]): RestRelease[] {
    core.info(`Sorting ${plural(releases.length, 'release')} by date`);
    const getDate = (r: RestRelease) => new Date(r.published_at ?? r.created_at);
    return releases.sort((a, b) => getDate(b).getTime() - getDate(a).getTime());
}

// Truncate an ISO 8601 date-time to date-only
function normaliseDate(date: string): string {
    return date.split('T')[0] ?? date;
}
