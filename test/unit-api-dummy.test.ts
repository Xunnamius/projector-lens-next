// TODO: change api/dummy to the actual path
import AdminEndpoint, { config } from 'universe/pages/api/dummy';

// ! Note:
// !   - jest.mock calls are hoisted to the top even above imports
// !   - factory function of jest.mock(...) is not guaranteed to run early
// !   - better to manipulate mock in beforeAll() vs using a factory function

afterEach(() => {
  jest.clearAllMocks();
});

void AdminEndpoint, config;
test.todo('functions as expected');
