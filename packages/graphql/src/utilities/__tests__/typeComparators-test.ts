import type { GraphQLFieldConfigMap } from '../../type/definition.js';
import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../type/definition.js';
import { GraphQLFloat, GraphQLInt, GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { isEqualType, isTypeSubTypeOf } from '../typeComparators.js';

describe('typeComparators', () => {
  describe('isEqualType', () => {
    it('same reference are equal', () => {
      expect(isEqualType(GraphQLString, GraphQLString)).toEqual(true);
    });

    it('int and float are not equal', () => {
      expect(isEqualType(GraphQLInt, GraphQLFloat)).toEqual(false);
    });

    it('lists of same type are equal', () => {
      expect(isEqualType(new GraphQLList(GraphQLInt), new GraphQLList(GraphQLInt))).toEqual(true);
    });

    it('lists is not equal to item', () => {
      expect(isEqualType(new GraphQLList(GraphQLInt), GraphQLInt)).toEqual(false);
    });

    it('non-null of same type are equal', () => {
      expect(isEqualType(new GraphQLNonNull(GraphQLInt), new GraphQLNonNull(GraphQLInt))).toEqual(true);
    });

    it('non-null is not equal to nullable', () => {
      expect(isEqualType(new GraphQLNonNull(GraphQLInt), GraphQLInt)).toEqual(false);
    });
  });

  describe('isTypeSubTypeOf', () => {
    function testSchema(fields: GraphQLFieldConfigMap<unknown, unknown>) {
      return new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields,
        }),
      });
    }

    it('same reference is subtype', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLString, GraphQLString)).toEqual(true);
    });

    it('int is not subtype of float', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLInt, GraphQLFloat)).toEqual(false);
    });

    it('non-null is subtype of nullable', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, new GraphQLNonNull(GraphQLInt), GraphQLInt)).toEqual(true);
    });

    it('nullable is not subtype of non-null', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLInt, new GraphQLNonNull(GraphQLInt))).toEqual(false);
    });

    it('item is not subtype of list', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLInt, new GraphQLList(GraphQLInt))).toEqual(false);
    });

    it('list is not subtype of item', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, new GraphQLList(GraphQLInt), GraphQLInt)).toEqual(false);
    });

    it('member is subtype of union', () => {
      const member = new GraphQLObjectType({
        name: 'Object',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const union = new GraphQLUnionType({ name: 'Union', types: [member] });
      const schema = testSchema({ field: { type: union } });
      expect(isTypeSubTypeOf(schema, member, union)).toEqual(true);
    });

    it('implementing object is subtype of interface', () => {
      const iface = new GraphQLInterfaceType({
        name: 'Interface',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const impl = new GraphQLObjectType({
        name: 'Object',
        interfaces: [iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const schema = testSchema({ field: { type: impl } });
      expect(isTypeSubTypeOf(schema, impl, iface)).toEqual(true);
    });

    it('implementing interface is subtype of interface', () => {
      const iface = new GraphQLInterfaceType({
        name: 'Interface',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const iface2 = new GraphQLInterfaceType({
        name: 'Interface2',
        interfaces: [iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const impl = new GraphQLObjectType({
        name: 'Object',
        interfaces: [iface2, iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const schema = testSchema({ field: { type: impl } });
      expect(isTypeSubTypeOf(schema, iface2, iface)).toEqual(true);
    });
  });
});
