# Setting Up Repository Secrets

This guide will help you add the required secrets to your GitHub repository.

## Required Secrets

This project requires the following secrets to be configured in your GitHub repository:

| Secret Name | Description | Where to Get It |
|-------------|-------------|-----------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public API key | Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public` |
| `TWITTER_API_KEY` | Twitter API consumer key | Twitter Developer Portal → Your App → Keys and tokens → API Key |
| `TWITTER_API_SECRET` | Twitter API consumer secret | Twitter Developer Portal → Your App → Keys and tokens → API Key Secret |
| `TWITTER_ACCESS_TOKEN` | Twitter access token | Twitter Developer Portal → Your App → Keys and tokens → Access Token |
| `TWITTER_ACCESS_SECRET` | Twitter access token secret | Twitter Developer Portal → Your App → Keys and tokens → Access Token Secret |
| `CFB_DATA_KEY` | College Football Data API key | College Football Data → Account Settings → API Key |

## Step-by-Step Instructions

### Adding Secrets to GitHub Repository

1. **Navigate to your repository** on GitHub (https://github.com/jaredwheet/duke_fb_scorigami)

2. **Go to Settings**
   - Click on the "Settings" tab at the top of the repository page

3. **Access Secrets**
   - In the left sidebar, click on "Secrets and variables"
   - Click on "Actions"

4. **Add Each Secret**
   - Click the "New repository secret" button
   - For each secret in the table above:
     - Enter the **Name** exactly as shown (e.g., `SUPABASE_URL`)
     - Paste the **Value** from your API provider
     - Click "Add secret"

5. **Verify**
   - Once all secrets are added, you should see them listed on the Actions secrets page
   - Note: You won't be able to view the values after adding them (for security)

## Getting Your API Keys

### Supabase

1. Go to https://supabase.com
2. Log in or create an account
3. Create a new project or select an existing one
4. Go to Project Settings (gear icon in the left sidebar)
5. Click on "API" in the left menu
6. Copy the "Project URL" for `SUPABASE_URL`
7. Copy the "anon public" key for `SUPABASE_ANON_KEY`

### Twitter API

1. Go to https://developer.twitter.com
2. Log in with your Twitter account
3. Apply for API access if you haven't already
4. Create a new App or use an existing one
5. Go to your App's "Keys and tokens" section
6. Copy the API Key and Secret
7. Generate Access Token and Secret if not already created
8. Copy all four values for the corresponding secrets

### College Football Data API

1. Go to https://collegefootballdata.com
2. Click "Sign Up" or "Log In"
3. Once logged in, go to your Account Settings
4. Find your API key
5. Copy the key for `CFB_DATA_KEY`

## Testing Your Configuration

After adding the secrets:

1. Try running a GitHub Actions workflow (if you have one configured)
2. The workflow should now have access to these secrets as environment variables
3. Check the workflow logs to ensure no authentication errors occur

## Security Notes

- **Never commit** your `.env` file to Git - it's already in `.gitignore`
- **Never share** your API keys or secrets publicly
- **Rotate keys** regularly for better security
- If you accidentally expose a key, revoke it immediately and generate a new one

## Troubleshooting

### Workflow failing with authentication errors?
- Double-check that secret names match exactly (they are case-sensitive)
- Verify that you've added all required secrets
- Make sure the secret values don't have extra spaces or newlines

### Can't see the secret values?
- This is normal - GitHub hides secret values for security
- If you need to change a value, you must update the secret with a new value

### Need to update a secret?
- Go back to Settings → Secrets and variables → Actions
- Click on the secret name
- Click "Update secret"
- Enter the new value and save
