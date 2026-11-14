import type { Aggregate, MongooseDefaultQueryMiddleware, Query, Schema } from 'mongoose';
import { TenantIsolationError } from '../../shared/errors';

/**
 * Safety net for multi-tenancy: any query missing company_id throws instead of
 * leaking data across companies. Opt out (seed/migrations) with
 * `.setOptions({ skipTenantGuard: true })`.
 */
const QUERY_OPS: MongooseDefaultQueryMiddleware[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'countDocuments',
  'distinct',
];

declare module 'mongoose' {
  interface QueryOptions {
    skipTenantGuard?: boolean;
  }
  interface AggregateOptions {
    skipTenantGuard?: boolean;
  }
}

export function tenantGuard(schema: Schema, opts: { field?: string } = {}): void {
  const field = opts.field ?? 'company_id';

  schema.pre(QUERY_OPS, function (this: Query<unknown, unknown>) {
    if (this.getOptions().skipTenantGuard) return;
    const filter = this.getFilter() as Record<string, unknown>;
    if (filter[field] == null) {
      throw new TenantIsolationError('query', this.model.modelName);
    }
  });

  schema.pre('aggregate', function (this: Aggregate<unknown>) {
    if (this.options.skipTenantGuard) return;
    const first = this.pipeline()[0] as Record<string, Record<string, unknown>> | undefined;
    if (!first?.$match || first.$match[field] == null) {
      throw new TenantIsolationError('aggregate', 'pipeline');
    }
  });
}
