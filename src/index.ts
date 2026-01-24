// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { getOctokit } from '@actions/github';
import * as core from '@actions/core';
import { getReleases } from './get_releases.js';
import { stripBodiesText } from './strip_text.js';
import { plural } from './utils.js';
import { truncateReleases } from './truncate_releases.js';

// GPT tokeniser: 1 token ≈ 4 prose characters or 3-3.5 for code/logs
const CHARS_PER_TOKEN = 3.5; // (3.9 is typical for releases, plus some margin)

// Script entry point
async function run(): Promise<void> {
    // Action inputs
    const repository    =        core.getInput          ('repository',    { required: true });
    const min_releases  = Number(core.getInput          ('min_releases',  { required: true }));
    const max_releases  = Number(core.getInput          ('max_releases',  { required: true }));
    const max_age_days  = Number(core.getInput          ('max_age_days',  { required: true }));
    const max_tokens    = Number(core.getInput          ('max_tokens',    { required: true }));
    const strip_links   =        core.getBooleanInput   ('strip_links',   { required: true });
    const strip_images  =        core.getBooleanInput   ('strip_images',  { required: true });
    const strip_html    =        core.getBooleanInput   ('strip_html',    { required: true });
    const strip_regexps =        core.getMultilineInput ('strip_regexps', { required: false });
    const token         =        core.getInput          ('github_token',  { required: true });

    // Create an authenticated GitHub client
    const github = getOctokit(token);

    // Retrieve the list of releases and exclude unpublished/prerelease
    const releases = await getReleases(github, repository);

    // Remove any unwanted content from the release bodies
    const stripOptions = { strip_links, strip_images, strip_html, strip_regexps };
    const stripped = stripBodiesText(releases, stripOptions);

    // Truncate the releases to fit within the available context
    const max_chars = max_tokens * CHARS_PER_TOKEN;
    core.info(`Budget for releases context: ${plural(max_chars, 'character')} = ${plural(max_tokens, 'token')}`);
    const truncateOptions = { min_releases, max_releases, max_age_days, max_chars };
    const truncated = truncateReleases(stripped, truncateOptions);

    // Action outputs
    core.setOutput('releases', truncated);
}

// Run the script and handle errors
try {
    await run();
} catch (err) {
    core.setFailed(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    if (err instanceof Error && err.stack) core.debug(err.stack);
}