import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { tenantGuard } from '../db/plugins/tenantGuard';
import { toJSONPlugin } from '../db/plugins/toJSON';
import { normalizeText } from '../shared/text';

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    imageUrl: { type: String, default: '', trim: true },
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    searchText: { type: String, select: false },
  },
  { timestamps: true },
);

productSchema.index({ company_id: 1, createdAt: -1 });
productSchema.index({ company_id: 1, category: 1, price: 1 });
productSchema.index({ company_id: 1, name: 1 });

productSchema.pre('validate', function () {
  this.price = Math.round(this.price * 100) / 100;
  this.searchText = normalizeText(`${this.name} ${this.category} ${this.description}`);
});

productSchema.plugin(tenantGuard);
productSchema.plugin(toJSONPlugin);

export type Product = InferSchemaType<typeof productSchema>;
export type ProductDocument = HydratedDocument<Product>;
export const ProductModel = model('Product', productSchema);
