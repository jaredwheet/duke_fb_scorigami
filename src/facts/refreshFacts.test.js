import { fetchAllRows } from './refreshFacts.js';

function pagedClient(pages) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        range(offset) {
          return Promise.resolve({ data: pages[offset] || [], error: null });
        },
      };
    },
  };
}

test('fetches every page when canonical tables exceed the API page size', async () => {
  const rows = await fetchAllRows(pagedClient({
    0: [{ id: 1 }, { id: 2 }],
    2: [{ id: 3 }],
  }), 'games', 'id', { pageSize: 2 });

  expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
});
