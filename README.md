# SmartStock

SmartStock is a batch-level inventory and expiry alert app built with React and Vite. Inventory is shared through a Netlify Function and Netlify Blobs; the first request seeds the store with the sample data in `src/data/demoInventory.js`. Inventory changes are validated on the server and use version checks to detect edits made in another session. The browser keeps a local copy for startup and temporary network outages.

## Run locally

```sh
npm install
npm run dev
```

The Netlify Vite plugin provides local Functions and Blobs emulation inside Vite. Use `npm run dev` to exercise the inventory API. `npm run preview` serves only the built static site and does not emulate the backend.

## Deploy on Netlify

1. Push this project to a Git provider and choose **Add new site → Import an existing project** in Netlify.
2. Select the repository and set its base directory to the folder containing this `package.json` if the app is nested in the repository.
3. Use the build command `npm run build` and publish directory `dist`. `netlify.toml` also configures these values and the `netlify/functions` directory.
4. Deploy the site. Netlify Functions and Blobs are available to the function at runtime without a separate database URL or API key.
5. Open the deployed site and confirm the header says **Shared · synced**. Add or edit a batch, then open the site in another browser to confirm the change is shared.

The inventory is shared by every visitor to this demo site. There is no sign-in or access control, so anyone who can reach the public site can change its inventory. Add authentication and authorization before using this deployment for private or real store data.
