import Foundation

/*
 * Christmas (src/season.ts): from 1 December to 6 January (each person's own calendar), the room gets a tree where
 * the plant was, fairy lights and two stockings on the mantel, a wreath on the dark door and snow outside, and the
 * Cozy look's terracotta and sage turn Christmas red and pine. Anyone can turn it off, just for their own phone.
 */

public enum Season {
    /// whether it's Christmas on a day (YYYY-MM-DD)
    public static func christmas(_ today: String) -> Bool {
        let u = Array(today.utf8)
        guard u.count >= 10 else { return false }
        func num(_ a: Int, _ b: Int) -> Int { Int(String(decoding: u[a..<b], as: UTF8.self)) ?? 0 }
        let m = num(5, 7), d = num(8, 10)
        return m == 12 || (m == 1 && d >= 1 && d <= 6)
    }
}
