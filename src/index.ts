// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { getOctokit } from '@actions/github';
import * as core from '@actions/core';
import { getRepoReleases } from './releases_repo.js';
import { stripBodiesText } from './strip_text.js';
import { plural } from './utils.js';
import { truncateReleases } from './truncate_releases.js';
import { Release } from './releases.js';
import { getMarkdownReleases } from './releases_md.js';
import { getHtmlReleases } from './releases_html.js';

// GPT tokeniser: 1 token ≈ 4 prose characters or 3-3.5 for code/logs
const CHARS_PER_TOKEN = 3.5; // (3.9 is typical for releases, plus some margin)

// Script entry point
async function run(): Promise<void> {
    // Action inputs
    const repository        =        core.getInput          ('repository',          { required: true });
    const html_url          =        core.getInput          ('html_url',            { required: false });
    const md_url            =        core.getInput          ('md_url',              { required: false });
    const min_releases      = Number(core.getInput          ('min_releases',        { required: true }));
    const max_releases      = Number(core.getInput          ('max_releases',        { required: true }));
    const max_age_days      = Number(core.getInput          ('max_age_days',        { required: true }));
    const max_tokens        = Number(core.getInput          ('max_tokens',          { required: true }));
    const html_regexps      =        core.getMultilineInput ('html_regexps',        { required: false });
    const md_release_regexp =        core.getInput          ('md_release_regexp',   { required: false });
    const strip_links       =        core.getBooleanInput   ('strip_links',         { required: true });
    const strip_images      =        core.getBooleanInput   ('strip_images',        { required: true });
    const strip_html        =        core.getBooleanInput   ('strip_html',          { required: true });
    const strip_regexps     =        core.getMultilineInput ('strip_regexps',       { required: false });
    const token             =        core.getInput          ('github_token',        { required: true });

    // Obtain list of releases, either from URL or GitHub repo releases API
    let releases: Release[];
    if (html_url) {
        // Retrieve releases from an HTML document
        releases = await getHtmlReleases(html_url, html_regexps, md_release_regexp);
    } else if (md_url) {
        // Retrieve releases from a Markdown document
        releases = await getMarkdownReleases(md_url, md_release_regexp);
    } else {
        // Use GitHub API to retrieve releases from a repository
        const github = getOctokit(token);
        releases = await getRepoReleases(github, repository);
    }

    // Normalise dates and remove any unwanted content from the release bodies
    const stripOptions = { strip_links, strip_images, strip_html, strip_regexps };
    const stripped = stripBodiesText(releases, stripOptions);

    // Attempt to truncate the releases to fit within the available context
    const max_chars = max_tokens * CHARS_PER_TOKEN;
    core.info(`Budget for releases context: ${plural(max_chars, 'character')} = ${plural(max_tokens, 'token')}`);
    const truncateOptions = { min_releases, max_releases, max_age_days, max_chars };
    const truncated = truncateReleases(stripped, truncateOptions);

    // Action outputs
    core.setOutput('releases', truncated);
}

// Run the script and handle errors
void (async () => {
    try {
        await run();
    } catch (err) {
        core.setFailed(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        if (err instanceof Error && err.stack) core.debug(err.stack);
    }
})();