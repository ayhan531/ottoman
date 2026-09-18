// Arayüz dili — UI/Lang.cs karşılığı. Metinler kodda Türkçe yazılır, T() seçili dile çevirir;
// karşılığı olmayan metin (sembol, şirket adı, sayı) olduğu gibi kalır.
import { LANG } from "./lang-table.js";

export const LANG_CODES = LANG.codes;
export const LANG_NAMES = LANG.names;

let index = 0;

export const setLangIndex = (value) => {
  index = Math.min(LANG.codes.length - 1, Math.max(0, Number(value) || 0));
};

export const getLangIndex = () => index;

/** Seçili dilin kültürü; tarihler bununla yazılır (para birimi her dilde TL kalır). */
export const locale = () => LANG.locales[index];

/** Türkçe anahtarı seçili dile çevirir. */
export function T(text) {
  if (index === 0 || !text) return text;
  const row = LANG.table[text];
  return row ? row[index - 1] : text;
}

/** "{0}" içeren anahtarları doldurur (string.Format karşılığı). */
export function TF(text, ...values) {
  const base = T(text);
  return base.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? ""));
}

/** Tarihi seçili dilin kültürüyle yazar. */
export const date = (value, options) => new Date(value).toLocaleDateString(locale(), options);
export const dateTime = (value, options) => new Date(value).toLocaleString(locale(), options);
