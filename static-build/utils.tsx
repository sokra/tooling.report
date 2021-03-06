/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { h, JSX, Fragment } from 'preact';

import { promises as fsp } from 'fs';
import { join as joinPath } from 'path';

import render from 'preact-render-to-string';
import { VNode } from 'preact';

import config from 'consts:config';

export function githubLink(
  filePath: string,
  ref: string = config.githubDefaultBranch,
) {
  return `${config.githubRepository}tree/${ref}/${filePath}`;
}

export function renderPage(vnode: VNode) {
  return '<!DOCTYPE html>' + render(vnode);
}

interface OutputMap {
  [path: string]: string;
}

export function writeFiles(toOutput: OutputMap) {
  Promise.all(
    Object.entries(toOutput).map(async ([path, content]) => {
      const pathParts = ['.tmp', 'build', 'static', ...path.split('/')];
      await fsp.mkdir(joinPath(...pathParts.slice(0, -1)), { recursive: true });
      const fullPath = joinPath(...pathParts);
      try {
        await fsp.writeFile(fullPath, content, {
          encoding: 'utf8',
        });
      } catch (err) {
        console.error('Failed to write ' + fullPath);
        throw err;
      }
    }),
  ).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

interface ScoreForToolTest {
  score: number;
  possible: number;
}

export function calculateScore(test: Test, tool: BuildTool): ScoreForToolTest {
  let score = 0;
  let possible = 0;

  if (test.results[tool]) {
    possible = 1;

    switch (test.results[tool].meta.result) {
      case 'pass':
        score = 1;
        break;
      case 'partial':
        score = 0.5;
        break;
      // All other values are value = 0;
    }
  }
  if (test.subTests) {
    for (const subtest of Object.values(test.subTests)) {
      const subtestScore = calculateScore(subtest, tool);
      score += subtestScore.score;
      possible += subtestScore.possible;
    }
  }
  return { score, possible };
}

interface ToolSummary extends ScoreForToolTest {
  tool: BuildTool;
}

export function calculateScoreTotals(tests: Tests): ToolSummary[] {
  const tools = config.testSubjects;
  const testValues = Object.values(tests);

  return tools.map(tool => {
    let score = 0;
    let possible = 0;

    for (const test of testValues) {
      const result = calculateScore(test, tool);
      score += result.score;
      possible += result.possible;
    }
    return { tool, score, possible };
  });
}

export function renderIssueLinksForTest(test: Test, tool: BuildTool) {
  const result = test.results[tool];
  if (!result) {
    return;
  }
  let issues = result.meta.issue;
  if (!issues) {
    return;
  }
  // TODO: Would be nice to grab the issue titles and stuff
  // https://github.com/GoogleChromeLabs/tooling.report/issues/34
  return (
    <Fragment>
      <h2>Issues</h2>
      <ul class="issues">
        {issues.map(issue => (
          <li
            style={
              issue.status === 'open' ? '' : 'text-decoration: line-through'
            }
          >
            {issue.url === 'N/A' ? (
              'N/A'
            ) : (
              <a href={issue.url}>
                {issue.githubData ? issue.githubData.title : issue.url}
              </a>
            )}
          </li>
        ))}
      </ul>
    </Fragment>
  );
}
