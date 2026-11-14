import type { Schema } from 'mongoose';

export function toJSONPlugin(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      delete ret.tokenVersion;
      delete ret.tokenHash;
      delete ret.searchText;
      return ret;
    },
  });
}
