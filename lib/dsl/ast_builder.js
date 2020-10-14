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

const _ = require('lodash');
const JDLParser = require('./jdl_parser');
const { deduplicate } = require('../utils/array_utils');
const { formatComment } = require('../utils/format_utils');

module.exports = {
  buildAst
};

const parser = JDLParser.getParser();
parser.parse();

const BaseJDLCSTVisitor = parser.getBaseCstVisitorConstructor();

class JDLAstBuilderVisitor extends BaseJDLCSTVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  prog(context) {
    const ast = {
      applications: [],
      deployments: [],
      constants: {},
      entities: [],
// added begin by yingmingbo
      datasets: [],
      pages: [],
      jsonConfigs: [],
// added end by yingmingbo
      relationships: [],
      enums: [],
      options: {
        dto: {},
        pagination: {},
        service: {},
        microservice: {},
        search: {},
        skipClient: {},
        skipServer: {},
        filter: {},
        angularSuffix: {},
        noFluentMethod: {},
        readOnly: {},
        embedded: {},
        clientRootFolder: {}
      }
    };

    if (context.constantDeclaration) {
      const constants = context.constantDeclaration.map(this.visit, this);
      constants.forEach(currConst => {
        ast.constants[currConst.name] = currConst.value;
      });
    }

    if (context.applicationDeclaration) {
      ast.applications = context.applicationDeclaration.map(this.visit, this);
    }

    if (context.deploymentDeclaration) {
      ast.deployments = context.deploymentDeclaration.map(this.visit, this);
    }

    if (context.entityDeclaration) {
      ast.entities = context.entityDeclaration.map(this.visit, this);
    }
// added begin by yingmingbo

    if (context.datasetDeclaration) {
      ast.datasets = _.flatMap(context.datasetDeclaration, item => this.visit(item));
    }

    if (context.pageDeclaration) {
      ast.pages = _.flatMap(context.pageDeclaration, item => this.visit(item));
    }

    if (context.jsonConfigDeclaration) {
      ast.jsonConfigs = _.flatMap(context.jsonConfigDeclaration, item => this.visit(item));
    }
// added end by yingmingbo

    if (context.relationDeclaration) {
      ast.relationships = _.flatMap(context.relationDeclaration, item => this.visit(item));
    }

    if (context.enumDeclaration) {
      ast.enums = context.enumDeclaration.map(this.visit, this);
    }

    function setOptionEntityAndExcludedEntityLists(astResult, option) {
      astResult.list = astResult.list || [];
      astResult.list = deduplicate(astResult.list.concat(option.list));

      if (option.excluded) {
        astResult.excluded = astResult.excluded || [];
        astResult.excluded = deduplicate(astResult.excluded.concat(option.excluded));
      }
    }

    if (context.unaryOptionDeclaration) {
      context.unaryOptionDeclaration.map(this.visit, this).forEach(option => {
        const astResult = ast.options[option.optionName];

        setOptionEntityAndExcludedEntityLists(astResult, option);
      });
    }

    if (context.binaryOptionDeclaration) {
      context.binaryOptionDeclaration.map(this.visit, this).forEach(option => {
        let astResult;

        if (option.optionName === 'paginate') {
          option.optionName = 'pagination';
        }
        const newOptionValue = !ast.options[option.optionName][option.optionValue];
        if (newOptionValue) {
          astResult = { list: option.list, excluded: [] };
          ast.options[option.optionName][option.optionValue] = astResult;
        } else {
          astResult = ast.options[option.optionName][option.optionValue];
        }

        setOptionEntityAndExcludedEntityLists(astResult, option);
      });
    }

    return ast;
  }

  constantDeclaration(context) {
    return {
      name: context.NAME[0].image,
      value: context.INTEGER ? context.INTEGER[0].image : context.DECIMAL[0].image
    };
  }

  entityDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    let javadoc = null;
    if (context.JAVADOC) {
      javadoc = trimComment(context.JAVADOC[0].image);
    }

    const name = context.NAME[0].image;

    let tableName = name;
    if (context.entityTableNameDeclaration) {
      tableName = this.visit(context.entityTableNameDeclaration);
    }

    let body = [];
    if (context.entityBody) {
      body = this.visit(context.entityBody);
    }

    return {
      annotations,
      name,
      tableName,
      body,
      javadoc
    };
  }

  annotationDeclaration(context) {
    if (!context.value) {
      return { optionName: context.option[0].image, type: 'UNARY' };
    }
// added begin by yingmingbo

    if (context.value[0].name === 'variablesDeclaration') {

      const variables = [];
      context.value[0].children.variableDeclaration.forEach(contextObject => {
        const variable = this.visit(contextObject);
        variables.push(variable);
      });

      if (variables.length === 1 && typeof variables[0] === 'string') {
        return { optionName: context.option[0].image, optionValue: variables[0], type: 'BINARY' };
      } else {
        return { optionName: context.option[0].image, optionValue: variables, type: 'MAP' };
      }
    }

// added end by yingmingbo
    return { optionName: context.option[0].image, optionValue: context.value[0].image, type: 'BINARY' };
  }

  entityTableNameDeclaration(context) {
    return context.NAME[0].image;
  }

  entityBody(context) {
    if (!context.fieldDeclaration) {
      return [];
    }
    return context.fieldDeclaration.map(element => this.visit(element));
  }

  fieldDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    // filter actual comment as the comment rule may be empty
    const comment = context.JAVADOC ? trimComment(context.JAVADOC[0].image) : null;

    let validations = [];
    if (context.validation) {
      validations = context.validation.map(element => this.visit(element));
    }

    return {
      name: context.NAME[0].image,
      // context.type is an array with a single item.
      // in that case:
      // this.visit(context.type) is equivalent to this.visit(context.type[0])
      type: this.visit(context.type),
      validations,
      javadoc: comment,
      annotations
    };
  }

  type(context) {
    return context.NAME[0].image;
  }

  validation(context) {
    // only one of these alternatives can exist at the same time.
    if (context.REQUIRED) {
      return {
        key: 'required',
        value: ''
      };
    }
    if (context.UNIQUE) {
      return {
        key: 'unique',
        value: ''
      };
    }
    if (context.minMaxValidation) {
      return this.visit(context.minMaxValidation);
    }
// added begin by yingmingbo
    if (context.readonly) {
      return this.visit(context.readonly);
    }
// added end by yingmingbo
    return this.visit(context.pattern);
  }

  minMaxValidation(context) {
    if (context.NAME) {
      return {
        key: context.MIN_MAX_KEYWORD[0].image,
        value: context.NAME[0].image,
        constant: true
      };
    }

    return {
      key: context.MIN_MAX_KEYWORD[0].image,
      value: context.INTEGER ? context.INTEGER[0].image : context.DECIMAL[0].image
    };
  }

  pattern(context) {
    const patternImage = context.REGEX[0].image;

    return {
      key: 'pattern',
      value: patternImage.substring(1, patternImage.length - 1)
    };
  }
// added begin by yingmingbo

  variablesDeclaration(context) {
    return context.NAME[0].image;
  }

  variableDeclaration(context) {
    if (context.NAME && context.STRING) {
      const variableImage = context.STRING[0].image;
      const variable = {
        key: context.NAME[0].image,
        value: variableImage.substring(1, variableImage.length - 1)
      };
      return variable;
    } else if (context.NAME && !context.STRING) {
      return context.NAME[0].image;
    } else if (!context.NAME && context.STRING) {
      if (context.STRING.length > 1) {
        const keyImage = context.STRING[0].image;
        const variableImage = context.STRING[1].image;
        return {
          key: keyImage.substring(1, keyImage.length - 1),
          value: variableImage.substring(1, variableImage.length - 1)
        };
      } else {
        const keyImage = context.STRING[0].image;
        return keyImage.substring(1, keyImage.length - 1);
      }
    }
  }

  readonly(context) {
    const readonlyImage = context.REGEX[0].image;

    return {
      key: 'readonly',
      value: readonlyImage.substring(1, readonlyImage.length - 1)
    };
  }

  datasetDeclaration(context) {
    const datasetName = this.visit(context.datasetName);
    const datasetBody = this.visit(context.datasetBody);
    return {name: datasetName, set: trimDataBlock(datasetBody)};
  }

  datasetName(context) {
    return context.NAME[0].image;
  }

  datasetBody(context) {
    return context.DATA_BLOCK[0].image;
  }

  pageDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    let values = [];
    if (context.pageTabsDeclaration) {
      context.pageTabsDeclaration.forEach(contextObject => {
        values = values.concat(this.visit(contextObject));
      });
    }
    if (context.pageOthersDeclaration) {
      context.pageOthersDeclaration.forEach(contextObject => {
        values = values.concat(this.visit(contextObject));
      });
    }

    const ret = {
      type: 'page',
      name: context.name[0].image,
      entity: context.entity[0].image,
      annotations,
      values,
    };
    return ret;
  }

  pageTabsDeclaration(context) {
    const values = [];

    context.pageTabDeclaration.forEach(contextObject => {
      values.push(this.visit(contextObject));
    });

    return values;
  }

  pageTabDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    let values = [];
    if (context.pageOthersDeclaration) {
      context.pageOthersDeclaration.forEach(contextObject => {
        values = values.concat(this.visit(contextObject));
      });
    }

    return {
      type: 'tab',
      name: context.NAME[0].image,
      annotations,
      values,
    };
  }

  pageOthersDeclaration(context) {
    const values = [];

    context.pageOtherDeclaration.forEach(contextObject => {
      values.push(this.visit(contextObject));
    });

    return values;
  }

  pageOtherDeclaration(context) {
    if (context.pageFieldDeclaration) {
      return this.visit(context.pageFieldDeclaration);
    }
    if (context.pageGroupDeclaration) {
      return this.visit(context.pageGroupDeclaration);
    }
    if (context.pageGridDeclaration) {
      return this.visit(context.pageGridDeclaration);
    }

    return null;
  }

  pageGroupDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    let values = [];
    if (context.pageGroupsDeclaration) {
      context.pageGroupsDeclaration.forEach(contextObject => {
        values = values.concat(this.visit(contextObject));
      });
    }
    if (context.pageFieldsDeclaration) {
      context.pageFieldsDeclaration.forEach(contextObject => {
        values = values.concat(this.visit(contextObject));
      });
    }

    return {
      type: 'group',
      name: context.NAME[0].image,
      annotations,
      values,
    };
  }

  pageGridDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    let fields = [];
    if (context.pageLeafDeclaration) {
      context.pageLeafDeclaration.forEach(contextObject => {
        const field = this.visit(contextObject);
        fields.push(field);
      });
    }

    return {
      type: 'grid',
      name: context.NAME[0].image,
      annotations,
      fields,
    };
  }

  pageLeafDeclaration(context) {
    if (context.pageFieldDeclaration) {
      return this.visit(context.pageFieldDeclaration);
    }

    if (context.pageOperatesDeclaration) {
      return this.visit(context.pageOperatesDeclaration);
    }
  }

  pageFieldDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    const names = [];
    if (context.NAME) {
      context.NAME.forEach(contextObject => {
        names.push(contextObject.image);
      });
    }
    const name = names.join('.');
    return {
      type: 'field',
      name,
      annotations,
    };
  }

  pageOperatesDeclaration(context) {
    const annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }

    const operates = [];
    if (context.pageOperateDeclaration) {
      context.pageOperateDeclaration.forEach(contextObject => {
        operates.push(this.visit(contextObject));
      });
    }

    return {
      type: 'operate',
      annotations,
      operates
    };
  }

  pageOperateDeclaration(context) {
    let output = {
      type: 'action',
      key: context.NAME[0].image
    };

    output.annotations = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        output.annotations.push(this.visit(contextObject));
      });
    }

    output.actions = [];
    if (context.pageActionDeclaration) {
      context.pageActionDeclaration.forEach(contextObject => {
        const ret = this.visit(contextObject);
        output.actions.push(ret);
      });
    }

    return output;
  }

  pageActionDeclaration(context) {
    const key = context.NAME[0].image;
    let value = null;
    if (context.DATA_BLOCK && context.DATA_BLOCK[0].image) {
      value = context.DATA_BLOCK[0].image;
      value = trimDataBlock(value);
    } else if (context.NAME[1]) {
      value = context.NAME[1].image;
    } else if (context.STRING) {
      value = context.STRING[0].image;
    }

    return {
      type: 'field',
      key,
      value
    };
  }

  jsonConfigDeclaration(context) {
    const jsonConfigName = this.visit(context.jsonConfigName);
    const jsonConfigType = this.visit(context.jsonConfigType);
    const jsonConfigSubType = this.visit(context.jsonConfigSubType);
    const jsonConfigBody = this.visit(context.jsonConfigBody);
    return {name: jsonConfigName, set: {type: jsonConfigType, subtype: jsonConfigSubType, data: trimDataBlock(jsonConfigBody) } };
  }

  jsonConfigName(context) {
    return context.NAME[0].image;
  }

  jsonConfigType(context) {
    return context.NAME[0].image;
  }

  jsonConfigSubType(context) {
    return context.NAME[0].image;
  }

  jsonConfigBody(context) {
    return context.DATA_BLOCK[0].image;
  }
// added end by yingmingbo

  relationDeclaration(context) {
    const cardinality = this.visit(context.relationshipType);
    const relationshipBodies = context.relationshipBody.map(this.visit, this);

    relationshipBodies.forEach(relationshipBody => {
      relationshipBody.cardinality = cardinality;
    });

    return relationshipBodies;
  }

  relationshipType(context) {
    return context.RELATIONSHIP_TYPE[0].image;
  }

  relationshipBody(context) {
    const options = [];
    if (context.annotationDeclaration) {
      context.annotationDeclaration.forEach(contextObject => {
        options.push(this.visit(contextObject));
      });
    }
    const from = this.visit(context.from);
    const to = this.visit(context.to);

    if (context.relationshipOptions) {
      this.visit(context.relationshipOptions).forEach(o => options.push(o));
    }

    return { from, to, options };
  }

  relationshipSide(context) {
    const javadoc = this.visit(context.comment);
    const name = context.NAME[0].image;

// added begin by yingmingbo
    const readonly = this.visit(context.readonly);
    const annotations = [];
    if (context.annotations) {
      context.annotations.forEach(contextObject => {
        const annotation = this.visit(contextObject);
        annotations.push(annotation);
      });
    }
// added end by yingmingbo
    const required = !!context.REQUIRED;
    let injectedField = null;
    let annotationsOfField = [];

    if (context.injectedField) {
      injectedField = context.injectedField[0].image;
// modified begin by yingmingbo
      let injectedFieldParams = this.visit(context.injectedFieldParams);
      let injectedFields = [];
      if (injectedFieldParams && injectedFieldParams.length > 0) {
        injectedField += '(';
        injectedFieldParams.forEach(param => {
          injectedFields.push(param.name);
          param.annotations.forEach(annotation => {
            annotationsOfField.push({...annotation, key: param.name});
          });
        });
        injectedField += injectedFields.join(',');
        injectedField += ')';
      }
// modified end by yingmingbo
    }

    const ast = {
      name,
      injectedField,
      javadoc,
// added begin by yingmingbo
      annotations,
      annotationsOfField,
      readonly,
// added end by yingmingbo
      required
    };

    if (!injectedField) {
      delete ast.required;
    }
    return ast;
  }

  relationshipOptions(context) {
    return context.relationshipOption.map(this.visit, this).reduce((final, current) => [...final, current], []);
  }

  relationshipOption(context) {
    if (context.JPA_DERIVED_IDENTIFIER) {
      return { optionName: 'jpaDerivedIdentifier', type: 'UNARY' };
    }

    /* istanbul ignore next */
    throw new Error("No valid relationship option found, expected 'jpaDerivedIdentifier'.");
  }
// added begin by yingmingbo

  injectedFieldParams(context) {
    const params = [];
    if (context.injectedFieldParam) {
      context.injectedFieldParam.forEach(item => {
        const injectedFieldParam = this.visit(item);
        params.push(injectedFieldParam);
      });
    }
    return params;
  }

  injectedFieldParam(context) {
    const names = [];
    if (context.NAME) {
      context.NAME.forEach(contextObject => {
        names.push(contextObject.image);
      });
    }
    const name = names.join('.');

    const annotations = [];
    if (context.annotations) {
      context.annotations.forEach(contextObject => {
        annotations.push(this.visit(contextObject));
      });
    }
    return { name, annotations };
  }

// added end by yingmingbo

  enumDeclaration(context) {
    const name = context.NAME[0].image;
    const values = this.visit(context.enumPropList);

    return { name, values };
  }

  enumPropList(context) {
    return context.enumProp.map(this.visit, this);
  }

  enumProp(context) {
    const prop = {
      key: context.enumPropKey[0].image
    };
    if (context.enumPropValue) {
      prop.value = context.enumPropValue[0].image;
    }
    return prop;
  }

  entityList(context) {
    let entityList = [];
    if (context.NAME) {
      entityList = context.NAME.map(nameToken => nameToken.image);
    }

    const entityOnlyListContainsAll = entityList.length === 1 && entityList[0] === 'all';

    if (context.STAR || entityOnlyListContainsAll) {
      entityList = ['*'];
    }

    if (context.method) {
      entityList.push(context.method[0].image);
    }
    if (context.methodPath) {
      entityList.push(context.methodPath[0].image);
    }

    return deduplicate(entityList);
  }

  exclusion(context) {
    return context.NAME.map(nameToken => nameToken.image, this);
  }

  unaryOptionDeclaration(context) {
    return getUnaryOptionFromContext(context, this);
  }

  binaryOptionDeclaration(context) {
    return getBinaryOptionFromContext(context, this);
  }

  filterDef(context) {
    let entityList = [];
    if (context.NAME) {
      entityList = context.NAME.map(nameToken => nameToken.image, this);
    }

    const entityOnlyListContainsAll = entityList.length === 1 && entityList[0] === 'all';

    if (context.STAR || entityOnlyListContainsAll) {
      entityList = ['*'];
    }

    return deduplicate(entityList);
  }

  comment(context) {
    if (context.JAVADOC) {
      return trimComment(context.JAVADOC[0].image);
    }

    return null;
  }

  deploymentDeclaration(context) {
    const config = {};

    if (context.deploymentConfigDeclaration) {
      const configProps = context.deploymentConfigDeclaration.map(this.visit, this);
      configProps.forEach(configProp => {
        config[configProp.key] = configProp.value;
      });
    }

    return config;
  }

  deploymentConfigDeclaration(context) {
    const key = context.DEPLOYMENT_KEY[0].image;
    const value = this.visit(context.deploymentConfigValue);

    return { key, value };
  }

  deploymentConfigValue(context) {
    return this.configValue(context);
  }

  applicationDeclaration(context) {
    return this.visit(context.applicationSubDeclaration);
  }

  applicationSubDeclaration(context) {
    const applicationSubDeclaration = {
      config: {},
      entities: { entityList: [], excluded: [] }
    };

    if (context.applicationSubConfig) {
      // Apparently the pegjs grammar only returned the last config
      applicationSubDeclaration.config = this.visit(
        context.applicationSubConfig[context.applicationSubConfig.length - 1]
      );
    }

    if (context.applicationSubEntities) {
      // Apparently the pegjs grammar only returned the last entities
      applicationSubDeclaration.entities = this.visit(
        context.applicationSubEntities[context.applicationSubEntities.length - 1]
      );
    }

    return applicationSubDeclaration;
  }

  applicationSubConfig(context) {
    const config = {};

    if (context.applicationConfigDeclaration) {
      const configProps = context.applicationConfigDeclaration.map(this.visit, this);
      configProps.forEach(configProp => {
        config[configProp.key] = configProp.value;

        if (configProp.key === 'packageName' && !config.packageFolder) {
          config.packageFolder = configProp.value.replace(/[.]/g, '/');
        }
      });
    }

    return config;
  }

  applicationSubEntities(context) {
    return getEntityListFromContext(context, this);
  }

  applicationConfigDeclaration(context) {
    const key = context.CONFIG_KEY[0].image;
    const value = this.visit(context.configValue);

    return { key, value };
  }

  configValue(context) {
    if (context.qualifiedName) {
      return this.visit(context.qualifiedName);
    }
    if (context.list) {
      return this.visit(context.list);
    }
    if (context.INTEGER) {
      return context.INTEGER[0].image;
    }
    if (context.STRING) {
      const stringImage = context.STRING[0].image;
      return stringImage.substring(1, stringImage.length - 1);
    }
    if (context.BOOLEAN) {
      return context.BOOLEAN[0].image === 'true';
    }

    /* istanbul ignore next */
    throw new Error(
      'No valid config value was found, expected a qualified name, a list, an integer, a string or a boolean.'
    );
  }

  qualifiedName(context) {
    return context.NAME.map(namePart => namePart.image, this).join('.');
  }

  list(context) {
    if (!context.NAME) {
      return [];
    }
    return context.NAME.map(namePart => namePart.image, this);
  }
}

function getEntityListFromContext(context, visitor) {
  const entityList = visitor.visit(context.filterDef);

  let excluded = [];
  if (context.exclusion) {
    excluded = visitor.visit(context.exclusion);
  }

  const result = { entityList, excluded };
  if (context.UNARY_OPTION) {
    result.optionName = context.UNARY_OPTION[0].image;
  }
  return result;
}

function getUnaryOptionFromContext(context, visitor) {
  const entityList = visitor.visit(context.filterDef);

  let excluded = [];
  if (context.exclusion) {
    excluded = visitor.visit(context.exclusion);
  }

  return { optionName: context.UNARY_OPTION[0].image, list: entityList, excluded };
}

function getBinaryOptionFromContext(context, visitor) {
  const entityListWithOptionValue = visitor.visit(context.entityList);
  const optionValue = entityListWithOptionValue[entityListWithOptionValue.length - 1];
  const list = _.dropRight(entityListWithOptionValue);

  let excluded = [];
  if (context.exclusion) {
    excluded = visitor.visit(context.exclusion);
  }

  return {
    optionName: context.BINARY_OPTION[0].image,
    optionValue,
    list,
    excluded
  };
}

function trimComment(comment) {
  return comment.replace(/^\/[*]+/, '').replace(/[*]+\/$/, '');
}

const astBuilderVisitor = new JDLAstBuilderVisitor();

function buildAst(cst) {
  return astBuilderVisitor.visit(cst);
}
// added begin by yingmingbo

function trimDataBlock(dataBlock) {
  return dataBlock.replace(/^\/\*\#/, '').replace(/[*]+\/$/, '');
}
// added end by yingmingbo
