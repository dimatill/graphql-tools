import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { GraphQLObjectType } from '../type/definition.js';
import { isAbstractType } from '../type/definition.js';
import { GraphQLIncludeDirective, GraphQLSkipDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

import { getDirectiveValues } from './values.js';

/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode
): Map<string, ReadonlyArray<FieldNode>> {
  const fields = new AccumulatorMap<string, FieldNode>();
  collectFieldsImpl(schema, fragments, variableValues, runtimeType, selectionSet, fields, new Set());
  return fields;
}

/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns them at the end.
 *
 * CollectSubFields requires the "return type" of an object. For a field that
 * returns an Interface or Union type, the "return type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  returnType: GraphQLObjectType,
  fieldNodes: ReadonlyArray<FieldNode>
): Map<string, ReadonlyArray<FieldNode>> {
  const subFieldNodes = new AccumulatorMap<string, FieldNode>();
  const visitedFragmentNames = new Set<string>();
  for (const node of fieldNodes) {
    if (node.selectionSet) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        returnType,
        node.selectionSet,
        subFieldNodes,
        visitedFragmentNames
      );
    }
  }
  return subFieldNodes;
}

function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: AccumulatorMap<string, FieldNode>,
  visitedFragmentNames: Set<string>
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        fields.add(getFieldEntryKey(selection), selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }
        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        if (visitedFragmentNames.has(fragName) || !shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        visitedFragmentNames.add(fragName);
        const fragment = fragments[fragName];
        if (!fragment || !doesFragmentConditionMatch(schema, fragment, runtimeType)) {
          continue;
        }
        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      }
    }
  }
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.['if'] === true) {
    return false;
  }

  const include = getDirectiveValues(GraphQLIncludeDirective, node, variableValues);
  if (include?.['if'] === false) {
    return false;
  }
  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  schema: GraphQLSchema,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return schema.isSubType(conditionalType, type);
  }
  return false;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}
