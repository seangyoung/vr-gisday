# GeoSlice Challenge

This Quest-first VR quiz uses ten individually approved geography and GIS questions. The order of questions and the four answer blocks changes with each round.

Visitors turn to find letter tiles arranged in a full circle around them, slice three for their initials, and then slice Start. Each question appears alone for 2.6 seconds. Four answer blocks then appear side by side in one row and the 18-second timer begins. Slicing a correct block earns 100 base points plus up to 100 speed points. Wrong answers and timeouts earn zero. After feedback, the next question starts. A opens the sound menu and pauses play; B pauses and asks whether to continue or quit without saving.

The leaderboard uses `localStorage` in the Quest Browser profile. It shows the top ten scores for the current America/Chicago calendar day, automatically showing an empty daily board after midnight. The best scores from November 18, 2026 are kept in a separate archive in the same browser storage. Scores are saved only after all ten questions. This avoids an account and server, but clearing browser site data, using another profile, or using another headset loses access to the saved scores. It is a friendly local challenge, so anyone with access to browser storage can alter the results.

The code build and automated tests validate timing, shuffling, slicing geometry, and local score retention. A Quest 3S test is still needed for blade reach, text legibility, audio balance, and controller comfort.
