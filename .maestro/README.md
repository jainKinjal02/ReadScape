# ReadScape end-to-end tests

[Maestro](https://maestro.mobile.dev) flows that drive the app in the iOS
simulator the way a reader would: tapping, typing, and checking what appears.

They run against a dedicated **test account**, never a real reader's library.
The last flow deletes that account, which is itself the Delete account test.

## Running

1. Start the dev server: `npx expo start --port 8082`
2. Boot a simulator that has Expo Go installed.
3. Run, passing the test account:

   ```
   maestro test .maestro/flows -e EMAIL=you+readscape-test@example.com -e PASSWORD=...
   ```

   Flows run in name order (`01-…` first). `01-signup` needs a new email each
   time, and the account it creates must be confirmed from its inbox before
   `02-signin` can pass.

## Test cases

| ID | Area | Case | Flow |
|---|---|---|---|
| TC01 | Welcome | Welcome screen shows Create Account and Sign in | 01-signup |
| TC02 | Sign up | Empty name is refused with "Please enter your name." | 01-signup |
| TC03 | Sign up | Password under 6 characters is refused | 01-signup |
| TC04 | Sign up | Valid sign-up asks the reader to confirm their email, then switches to Sign In | 01-signup |
| TC05 | Sign in | Wrong password shows an error and stays on Sign In | 02-signin |
| TC06 | Sign in | First sign-in goes to onboarding | 02-signin |
| TC07 | Onboarding | Goal choice, a preset genre and a custom genre save, and Enter ReadScape opens Home | 02-signin |
| TC08 | Library | Empty library shows its empty state | 03-library-add |
| TC09 | Library | Search finds a book; adding it as Want puts it on the shelf | 03-library-add |
| TC10 | Library | **A book already on the shelf shows "In your library" and cannot be added again** (duplicate bug) | 03-library-add |
| TC11 | Library | A different edition of the same book is also recognised | 03-library-add |
| TC12 | Library | A book read years ago can be added straight to Read | 03-library-add |
| TC13 | Library | "Open" on an in-library result opens that book | 03-library-add |
| TC14 | Library | Status filters (Reading, Read, Waiting) show the right books | 04-library-browse |
| TC15 | Library | Searching the library narrows the shelf | 04-library-browse |
| TC16 | Book | Want → Reading shows "Where you are" and the session buttons | 05-book-lifecycle |
| TC17 | Book | Page can be edited and progress updates | 05-book-lifecycle |
| TC18 | Book | Mark finished moves the book to Read and celebrates | 05-book-lifecycle |
| TC19 | Book | Rating marks set the rating word | 05-book-lifecycle |
| TC20 | Book | Favourite toggles on and off | 05-book-lifecycle |
| TC21 | Book | Genres can be edited | 05-book-lifecycle |
| TC22 | Quotes | A quote with a page can be added and deleted | 06-quotes-notes |
| TC23 | Notes | A note can be added and deleted | 06-quotes-notes |
| TC24 | Session | A reading session needs a mood, then saves page, mood and quote | 07-session |
| TC25 | Session | The session's mood appears under "How it felt" | 07-session |
| TC26 | Voice | Recording a spoken note fills mood, quote and thought for review | 08-voice-note |
| TC27 | Voice | Saving keeps the recording, playable from the Notes tab | 08-voice-note |
| TC28 | Voice | Discarding saves nothing | 08-voice-note |
| TC29 | Home | Home shows the current read, counts and goal | 09-tabs |
| TC30 | Insights | Insights shows the year's books and moods | 09-tabs |
| TC31 | Notes tab | The Notes tab lists quotes and thoughts across books | 09-tabs |
| TC32 | Profile | Edit Profile saves a new name | 10-profile |
| TC33 | Profile | Log out returns to the welcome screen, and signing back in restores the library | 10-profile |
| TC34 | Book | Removing a book takes it off the shelf | 11-remove-book |
| TC35 | Account | Delete account removes the account; signing in again fails | 12-delete-account |
