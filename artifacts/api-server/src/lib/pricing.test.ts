import assert from "node:assert/strict";
import test from "node:test";
import {
  addUnitPrices,
  multiplyUnitPriceByQuantity,
  subtractUnitPrices,
  parseProviderQuantityValues,
  validateRequestedQuantity,
} from "./pricing.js";

test("unit price is provider unit price plus store profit per unit", () => {
  assert.equal(addUnitPrices("0.00010", "0.00011"), "0.00021000");
});

test("total price is final unit price multiplied by requested quantity", () => {
  assert.equal(multiplyUnitPriceByQuantity("0.00021", 3000), "0.63000000");
});

test("profit can be derived from final unit price without adding provider twice", () => {
  assert.equal(subtractUnitPrices("0.00011000", "0.00010000"), "0.00001000");
  assert.equal(addUnitPrices("0.00010000", "0.00001000"), "0.00011000");
});

test("range quantity validation respects provider minimum and admin maximum", () => {
  const info = parseProviderQuantityValues({ min: "3000", max: "500000" });

  assert.deepEqual(
    validateRequestedQuantity({
      quantityType: info.quantityType,
      requestedQuantity: 2000,
      minQuantity: info.minQuantity,
      maxQuantity: 50000,
    }),
    { ok: false, code: 106, message: "minimum quantity is 3000" },
  );

  assert.deepEqual(
    validateRequestedQuantity({
      quantityType: info.quantityType,
      requestedQuantity: 40000,
      minQuantity: info.minQuantity,
      maxQuantity: 50000,
    }),
    { ok: true },
  );
});

test("fixed quantity rejects anything except the fixed minimum quantity", () => {
  const info = parseProviderQuantityValues(null);

  assert.deepEqual(
    validateRequestedQuantity({
      quantityType: info.quantityType,
      requestedQuantity: 2,
      minQuantity: info.minQuantity,
    }),
    { ok: false, code: 106, message: "fixed quantity must be 1" },
  );
});

test("admin maximum overrides provider maximum", () => {
  const info = parseProviderQuantityValues({ min: "3000", max: "500000" });

  assert.deepEqual(
    validateRequestedQuantity({
      quantityType: info.quantityType,
      requestedQuantity: 25000,
      minQuantity: info.minQuantity,
      maxQuantity: 20000,
    }),
    { ok: false, code: 106, message: "maximum quantity is 20000" },
  );

  assert.deepEqual(
    validateRequestedQuantity({
      quantityType: info.quantityType,
      requestedQuantity: 15000,
      minQuantity: info.minQuantity,
      maxQuantity: 20000,
    }),
    { ok: true },
  );
});
