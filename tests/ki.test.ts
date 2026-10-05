import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fehlerCode, schluesselBereinigen, schluesselGueltig, schluesselMaske } from '../src/lib/ki/kiFehler.ts';

test('Schlüssel: Format und Bereinigung', () => {
  const echt = 'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-a7Q2';
  assert.equal(schluesselGueltig(echt), true);
  assert.equal(schluesselGueltig(schluesselBereinigen(` ${echt}\n`)), true);
  assert.equal(schluesselBereinigen('sk-ant- abc\ndef'), 'sk-ant-abcdef');
  assert.equal(schluesselGueltig(''), false);
  assert.equal(schluesselGueltig('sk-ant-kurz'), false);
  assert.equal(schluesselGueltig('sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'), false);
  assert.equal(schluesselGueltig('Hallo Welt, das ist kein Schlüssel'), false);
});

test('Schlüssel: Maske zeigt nur die letzten vier Zeichen', () => {
  assert.equal(schluesselMaske('sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-a7Q2'), 'sk-ant-…a7Q2');
});

test('Fehlercodes der API', () => {
  assert.equal(fehlerCode(401, '{"error":{"type":"authentication_error"}}'), 'schluessel');
  assert.equal(fehlerCode(403, ''), 'schluessel');
  assert.equal(fehlerCode(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}'), 'guthaben');
  assert.equal(fehlerCode(400, '{"error":{"message":"max_tokens: Field required"}}'), 'unbekannt');
  assert.equal(fehlerCode(404, ''), 'modell');
  assert.equal(fehlerCode(429, '{"error":{"type":"rate_limit_error"}}'), 'limit');
  assert.equal(fehlerCode(429, 'You have reached your specified API usage limits'), 'guthaben');
  assert.equal(fehlerCode(529, ''), 'ueberlastet');
  assert.equal(fehlerCode(500, ''), 'ueberlastet');
  assert.equal(fehlerCode(418, ''), 'unbekannt');
});
