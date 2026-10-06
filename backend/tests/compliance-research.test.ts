import assert from 'node:assert/strict';
import test from 'node:test';
import { assertArizonaResearchLocation, buildComplianceSearchQueries, classifyAuthority, isArizonaState } from '../src/services/complianceResearch';

test('automatic searches target the municipality, county, state, and named community', () => {
  const queries = buildComplianceSearchQueries({
    address: '123 Example Lane', city: 'Phoenix', state: 'AZ', postalCode: '85001',
    municipality: 'City of Phoenix', hoaName: 'Example Estates', communityDevelopment: 'Example Development',
  });

  assert.equal(queries.length, 4);
  assert.match(queries[0], /^\[CITY\].*City of Phoenix Phoenix Arizona/);
  assert.match(queries[1], /^\[COUNTY\].*Arizona county government/);
  assert.match(queries[2], /^\[STATE\] Arizona state government/);
  assert.match(queries[3], /^\[HOA\].*Example Estates Example Development Phoenix Arizona/);
  assert.match(queries[0], /-builder -contractor/);
});

test('authority classifier retains official city pages and rejects builder marketing', () => {
  const location = { address: '123 Example Lane', city: 'Phoenix', state: 'AZ', municipality: 'City of Phoenix' };
  const official = { title: 'Residential pool permits - Phoenix, Arizona', url: 'https://www.phoenix.gov/pdd/pool-permits', description: 'City of Phoenix Arizona Planning and Development Services' };
  const builder = { title: 'Phoenix pool builders and installation', url: 'https://examplepoolbuilder.com/phoenix', description: 'Request a free estimate from our pool company' };

  assert.deepEqual(classifyAuthority('CITY', official, 'City of Phoenix Arizona Building Safety pool permit application and inspections', location), {
    authorityType: 'CITY', authorityName: 'City of Phoenix',
  });
  assert.equal(classifyAuthority('CITY', builder, 'Phoenix pool builder services and free estimates', location), null);
});

test('authority classifier recognizes a city that uses a non-government web domain', () => {
  const location = { address: '123 Example Lane', city: 'Cedar Falls', state: 'AZ', municipality: 'City of Cedar Falls' };
  const result = { title: 'Building and zoning - Arizona', url: 'https://cedarfalls.example/building', description: 'City of Cedar Falls Arizona Community Development Department' };

  assert.deepEqual(classifyAuthority('CITY', result, 'City of Cedar Falls Arizona official municipal building permit services and pool inspections', location), {
    authorityType: 'CITY', authorityName: 'City of Cedar Falls',
  });
});

test('authority classifier can identify a non-government HOA domain from its content', () => {
  const location = { address: '123 Example Lane', city: 'Phoenix', state: 'AZ', hoaName: 'Example Estates' };
  const result = { title: 'Architectural review - Arizona', url: 'https://exampleestates.org/arc', description: 'Example Estates Arizona homeowners association pool guidelines' };

  assert.deepEqual(classifyAuthority('HOA', result, 'Example Estates Arizona Community Association Architectural Review Committee pool application', location), {
    authorityType: 'HOA', authorityName: 'Example Estates',
  });
});

test('rejects out-of-state research and sources without Arizona evidence', () => {
  assert.equal(isArizonaState('AZ'), true);
  assert.equal(isArizonaState('Arizona'), true);
  assert.equal(isArizonaState('TX'), false);
  assert.throws(() => assertArizonaResearchLocation({ address: '123 Main St', city: 'Austin', state: 'TX' }), /Arizona properties only/);
  const location = { address: '123 Main St', city: 'Phoenix', state: 'AZ', municipality: 'City of Phoenix' };
  const outOfState = { title: 'Pool permits', url: 'https://www.example.gov/pools', description: 'City of Phoenix municipal permits in Texas' };
  assert.equal(classifyAuthority('CITY', outOfState, 'Building permit and pool inspections', location), null);
});
