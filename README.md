# Closet Agent

1. Install dependencies (Node.js 22.6 or newer):
   ```sh
   npm install
   ```
2. Copy the environment template:
   ```sh
   cp .env.example .env.local
   ```
3. Add your `MAGIC_HOUR_API_KEY` to `.env.local`. Keep `NEXT_PUBLIC_DEMO_MODE=false` for real generation. Set it to `true` only for the explicitly labeled sample fallback, then restart the dev server (or rebuild for production). The key is used only by server routes.
4. Three preset JPGs are already included. To replace them, add garment photos at exactly:
   - `public/closet/black-overshirt.jpg`
   - `public/closet/grey-hoodie.jpg`
   - `public/closet/white-sweater.jpg`

   Included garment references and `public/demo-result.jpg` are sample UNIQLO product photography from [Black Overshirt](https://www.uniqlo.com/us/en/products/E477649-000/00?colorDisplayCode=09), [Grey Hoodie](https://www.uniqlo.com/us/en/products/E471808-000/00?colorDisplayCode=03), and [White Sweater](https://www.uniqlo.com/us/en/products/E453754-001/00). Replace with your own imagery for public use. Demo mode uses a sample photo; it does not generate a try-on.
5. Start locally:
   ```sh
   npm run dev
   ```
   Open [localhost:3000](http://localhost:3000). Upload a JPG/PNG under 4 MB, enter your plans, and click **STYLE MY DAY**. The local rules choose one garment; the server uploads both images through the [official Magic Hour upload API](https://docs.magichour.ai/api-reference/files/generate-asset-upload-urls), starts [Clothes Changer](https://docs.magichour.ai/api-reference/image-projects/ai-clothes-changer) once using the official Node SDK, and the page polls that project's status. Polling times out after three minutes; **Check Again** resumes the same project.
6. Build for production:
   ```sh
   npm run build
   npm start
   ```
7. Deploy to Vercel: push this directory to a Git repository, import it in Vercel, and select the Next.js preset with this directory as the project root. Add `MAGIC_HOUR_API_KEY` and `NEXT_PUBLIC_DEMO_MODE=false` in the project environment settings, then deploy. Use Node.js 22 or newer. Garment assets are included in server function tracing; uploads and project creation use a 120-second function limit, while polling uses separate short requests. Redeploy after changing the public demo flag. No database, accounts, or local persistent storage are needed.
