'use strict';

// GitHub action
// Copyright © 2026 Alexander Thoukydides
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const github_1 = require("@actions/github");
const core = tslib_1.__importStar(require("@actions/core"));
const releases_repo_js_1 = require("./releases_repo.js");
const strip_text_js_1 = require("./strip_text.js");
const utils_js_1 = require("./utils.js");
const truncate_releases_js_1 = require("./truncate_releases.js");
const releases_md_js_1 = require("./releases_md.js");
const releases_html_js_1 = require("./releases_html.js");
// GPT tokeniser: 1 token ≈ 4 prose characters or 3-3.5 for code/logs
const CHARS_PER_TOKEN = 3.5; // (3.9 is typical for releases, plus some margin)
// Script entry point
async function run() {
    // Action inputs
    const repository = core.getInput('repository', { required: true });
    const html_url = core.getInput('html_url', { required: false });
    const md_url = core.getInput('md_url', { required: false });
    const min_releases = Number(core.getInput('min_releases', { required: true }));
    const max_releases = Number(core.getInput('max_releases', { required: true }));
    const max_age_days = Number(core.getInput('max_age_days', { required: true }));
    const max_tokens = Number(core.getInput('max_tokens', { required: true }));
    const html_regexps = core.getMultilineInput('html_regexps', { required: false });
    const md_release_regexp = core.getInput('md_release_regexp', { required: false });
    const strip_links = core.getBooleanInput('strip_links', { required: true });
    const strip_images = core.getBooleanInput('strip_images', { required: true });
    const strip_html = core.getBooleanInput('strip_html', { required: true });
    const strip_regexps = core.getMultilineInput('strip_regexps', { required: false });
    const token = core.getInput('github_token', { required: true });
    // Obtain list of releases, either from URL or GitHub repo releases API
    let releases;
    if (html_url) {
        // Retrieve releases from an HTML document
        releases = await (0, releases_html_js_1.getHtmlReleases)(html_url, html_regexps, md_release_regexp);
    }
    else if (md_url) {
        // Retrieve releases from a Markdown document
        releases = await (0, releases_md_js_1.getMarkdownReleases)(md_url, md_release_regexp);
    }
    else {
        // Use GitHub API to retrieve releases from a repository
        const github = (0, github_1.getOctokit)(token);
        releases = await (0, releases_repo_js_1.getRepoReleases)(github, repository);
    }
    // Normalise dates and remove any unwanted content from the release bodies
    const stripOptions = { strip_links, strip_images, strip_html, strip_regexps };
    const stripped = (0, strip_text_js_1.stripBodiesText)(releases, stripOptions);
    // Attempt to truncate the releases to fit within the available context
    const max_chars = max_tokens * CHARS_PER_TOKEN;
    core.info(`Budget for releases context: ${(0, utils_js_1.plural)(max_chars, 'character')} = ${(0, utils_js_1.plural)(max_tokens, 'token')}`);
    const truncateOptions = { min_releases, max_releases, max_age_days, max_chars };
    const truncated = (0, truncate_releases_js_1.truncateReleases)(stripped, truncateOptions);
    // Action outputs
    core.setOutput('releases', truncated);
}
// Run the script and handle errors
void (async () => {
    try {
        await run();
    }
    catch (err) {
        core.setFailed(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        if (err instanceof Error && err.stack)
            core.debug(err.stack);
    }
})();
//# sourceMappingURL=index.js.map
