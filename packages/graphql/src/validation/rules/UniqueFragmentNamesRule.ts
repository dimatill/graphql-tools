import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

/**
 * Unique fragment names
 *
 * A GraphQL document is only valid if all defined fragments have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Name-Uniqueness
 */
export function UniqueFragmentNamesRule(context: ASTValidationContext): ASTVisitor {
  const knownFragmentNames = Object.create(null);
  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      const fragmentName = node.name.value;
      if (knownFragmentNames[fragmentName]) {
        context.reportError(
          new GraphQLError(`There can be only one fragment named "${fragmentName}".`, {
            nodes: [knownFragmentNames[fragmentName], node.name],
          })
        );
      } else {
        knownFragmentNames[fragmentName] = node.name;
      }
      return false;
    },
  };
}
