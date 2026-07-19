// Characters that cannot be confused with each other when a code is read
// aloud or copied by hand: no 0/O, no 1/I/l.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Generates a random meeting code, e.g. "kqp-4mn-x7t".
 *
 * Grouped in threes because that is far easier to say over a phone call
 * than an unbroken string. Uses crypto.getRandomValues rather than
 * Math.random so codes are not predictable from one another.
 */
export const generateMeetingCode = (groups = 3, groupSize = 3) => {
    const length = groups * groupSize;
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    const characters = Array.from(
        randomValues,
        (value) => ALPHABET[value % ALPHABET.length]
    );

    return Array.from({ length: groups }, (_, index) =>
        characters.slice(index * groupSize, (index + 1) * groupSize).join("")
    ).join("-");
};
