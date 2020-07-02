/** Copyright 2013-2020 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see http://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Rules = require('./rules');
const DatasetIssue = require('./issues/dataset_issue');

let issues;

module.exports = {
  checkDatasets
};

/**
 * Check datasets for lint issues.
 * That is done by passing the list of dataset declarations from the CST (from the JDLReader output).
 * @param {Array} datasetDeclarations - the list of dataset declarations
 * @return {Array} the found dataset issues.
 */
function checkDatasets(datasetDeclarations) {
  if (!datasetDeclarations || datasetDeclarations.length === 0) {
    return [];
  }
  issues = [];
  checkForCollapsibleDatasets(datasetDeclarations);
  return issues;
}

function checkForCollapsibleDatasets(datasetDeclarations) {

}
