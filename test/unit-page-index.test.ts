import IndexPage from 'universe/pages/index';

// ! Note:
// !   - jest.mock calls are hoisted to the top even above imports
// !   - factory function of jest.mock(...) is not guaranteed to run early
// !   - better to manipulate mock in beforeAll() vs using a factory function

afterEach(() => {
  jest.clearAllMocks();
});

void IndexPage;
test.todo('functions as expected');
