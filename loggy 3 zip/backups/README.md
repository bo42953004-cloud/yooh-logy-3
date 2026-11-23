# Backups

`paid-version-source.tar.gz` is a copy of the app's source from the version that had user accounts,
the one-device rule, the Stripe payment gate, referral commissions, downloads and the admin portal.
Those parts were removed from the app. Nothing here is loaded or built.

The owner email and password hash were stripped from the copy.

To bring that version back: unpack the archive over the project (`tar -xzf backups/paid-version-source.tar.gz`),
install the payment package (`npm install stripe`), and set a new owner login in `src/lib/auth/index.ts`.
Test logins on a deployed address: this platform's preview window does not keep sign-in cookies.

Delete this folder if you will never want that version again.
