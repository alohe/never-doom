# Contributing to NeverDoom

Thanks for wanting to add to the wall. Here's how.

## Adding a quote image

1. **Fork** this repo and clone it locally.

2. **Add your image** to the `images/` folder.
   - Use a descriptive kebab-case filename: `your-quote-name.png`
   - Accepted formats: `.png`, `.jpg`, `.webp`
   - Keep file size reasonable (under 1MB ideally)
   - Portrait or square orientation works best for the grid

3. **Add an entry** to `quotes.json`:

   ```json
   {
     "image": "images/your-quote-name.png",
     "text": "The quote text here",
     "author": "Author name or null",
     "tags": ["stoic", "mindset"]
   }
   ```

   - `image` (required): path to your image file
   - `text` (optional): the quote text (used for alt-text / accessibility)
   - `author` (optional): who said it, or `null`
   - `tags` (optional): categories like `"stoic"`, `"anime"`, `"nature"`, `"mindset"`, `"wisdom"`

4. **Test locally** -- just open `index.html` in your browser and make sure your image shows up.

5. **Open a pull request** with a short description of the quote.

## Guidelines

- Keep it motivational, calming, or grounding -- the kind of thing you'd want to see when you're stressed.
- No NSFW content.
- No hate speech or content targeting specific groups.
- Image should be legible and high enough quality to look good on screen.
- If you didn't create the image, make sure it's freely shareable or provide attribution.

## Questions?

Open an issue and we'll help you out.
