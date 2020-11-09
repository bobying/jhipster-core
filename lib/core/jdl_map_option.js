/**
 * Copyright 2013-2020 the original author or authors from the JHipster project.
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

const AbstractJDLOption = require('./abstract_jdl_option');
const { join } = require('../utils/set_utils');

/**
 * For options like the DTO, the service, etc.
 */
class JDLMapOption extends AbstractJDLOption {
  constructor(args) {
    super(args);
    if (args.value == null) {
      throw new Error('A map/array option must have a value.');
    }
    this.value = args.value;
  }

  getType() {
    return 'MAP';
  }

  toString() {
    const entityNames = join(this.entityNames, ', ');
    entityNames.slice(1, entityNames.length - 1);
    let optionName = this.name;
    const firstPart = `${optionName} ${entityNames} with ${this.value}`;
    if (this.excludedNames.size === 0) {
      return firstPart;
    }
    const excludedNames = join(this.excludedNames, ', ');
    excludedNames.slice(1, this.excludedNames.length - 1);
    return `${firstPart} except ${excludedNames}`;
  }
}

module.exports = JDLMapOption;