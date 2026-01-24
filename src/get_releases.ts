// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitHub } from '@actions/github/lib/utils.js';
import * as core from '@actions/core';
import { formatList, plural } from './utils.js';
import semver from 'semver';

// A simplified representation of a release
export interface Release {
    version:        string;
    published_at:   string;
    body:           string;
}

// Retrieve the list of releases in the specified repository
// (excluding specials, sorted by semver descending)
export async function getReleases(github: InstanceType<typeof GitHub>, repository: string): Promise<Release[]> {
    // Parse the repository specifier
    const [owner, repo] = repository.split('/', 2);
    if (!owner || !repo) throw new Error(`Invalid repository specifier: ${repository}`);

    // Retrieve the list of releases
    const releases = await github.paginate(github.rest.repos.listReleases, { owner, repo });
    core.info(`Retrieved ${plural(releases.length, 'release')})`);
    core.debug(`REST API Releases:\n${JSON.stringify(releases, null, 4)}`);

    // Exclude drafts and prereleases
    const draftsCount = releases.filter(r => r.draft).length;
    const prereleaseCount = releases.filter(r => r.prerelease).length;
    core.info(`Excluding ${plural(draftsCount, 'draft release')} and ${plural(prereleaseCount, 'prerelease')}`);
    const fullReleases = releases.filter(r => !r.draft && !r.prerelease);

    // Exclude any other releases with non-semver tags
    const nonSemverTags = fullReleases.map(r => r.tag_name).filter(t => !semver.valid(t));
    if (nonSemverTags.length) {
        core.info(`Excluding ${plural(nonSemverTags.length, 'release')} with non-semver tag: ${formatList(nonSemverTags)}`);
    }
    const filtered = fullReleases.filter(r => semver.valid(r.tag_name));

    // Convert to a simpler format, without optional properties
    const simplified: Release[] = filtered.map(r => ({
        version:        r.tag_name,
        published_at:   r.published_at ?? r.created_at,
        body:           r.body ?? ''
    }));

    // Reverse sort by semver
    return simplified.sort((a, b) => semver.rcompare(a.version, b.version));
}