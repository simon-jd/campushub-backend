# CampusHub client

React UI for the CampusHub API. The contract is `../docs/openapi.json`.

```sh
npm ci
npm test
npm run dev
```

`npm run dev` serves `http://127.0.0.1:5173` and proxies `/api` to the backend at `http://127.0.0.1:3000`. Start the backend before booking.
