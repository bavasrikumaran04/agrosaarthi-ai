import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

/**
 * Administrator-editable, NON-secret runtime settings (e.g. callback service
 * enabled, telephony default language). Values are validated per key by the
 * admin module. Secrets live only in environment variables.
 */
const appSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 100 },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseOptions('app_settings'),
);

export type AppSetting = InferSchemaType<typeof appSettingSchema>;
export type AppSettingDocument = HydratedDocument<AppSetting>;
export const AppSettingModel = model('AppSetting', appSettingSchema);
