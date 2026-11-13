# BBMP trade-licence applications, 2020–2024

Ward Wise aggregates public applications recorded from 1 January 2020 through 31 December 2024. The dates refer to applications. They do not measure shop openings or closures, business turnover, licence approvals, or the fraction of licences due that renewed on time.

## Provenance and reuse

BBMP is the original source. Vivek Matthew (Vonter) compiled the open release from the [BBMP trade-licence status portal](https://trade.bbmpgov.in/Forms/frmApplicationStatusPublic.aspx). Ward Wise uses the [1 September 2026 compressed release](https://github.com/Vonter/bbmp-trade-license/releases/download/bbmp-trade-license/trade-license.csv.gz). See the [upstream data dictionary](https://github.com/Vonter/bbmp-trade-license/blob/5fa911798135d5dd4f23f111f527c193f8ec6eeb/DATA.md) and [scraper and parser](https://github.com/Vonter/bbmp-trade-license/blob/5fa911798135d5dd4f23f111f527c193f8ec6eeb/parse.py). The original data release is available under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Some underlying contents are copyright BBMP. The derived application database is also distributed under ODbL 1.0. Team Codyssey prepared the aggregate. Keep the attribution and licence with redistributed copies. Cartography carries its separate DataMeet attribution.

The upstream release URL can change over time. The SHA-256 of the original compressed file is `0980a6cff9c7ba361c83172f9c5f32bda7245878456a8f0a62cfb6f9d2bd89cc`. The script fails on an unexpected checksum. If the release changes, use a retained copy with the documented digest or create and document a new version of the analysis using the updated source.

## Processing

1. Read the ISO date and select the five calendar years. The full source contains 952,985 trade line items; 358,635 fall within the chosen dates.
2. Group by application ID. The upstream parser writes one line per trade within an application. Combining 13,512 additional lines gives **345,123 distinct applications**. All lines within an ID agreed on application type, date and ward. All 198 ward names matched a distinct legacy boundary name using the published crosswalk. Of those, 130 matched after normalizing spelling case, punctuation and whitespace; 68 needed reviewed name aliases.
3. Assign one category per application. The eight substantive categories correspond to the eight numbered BBMP major-trade headings. Use the explicit category when a second line has a missing heading. Put applications spanning more than one numbered heading in **Multiple categories** (5,317). Keep applications with no numbered heading in **Unclassified** (46,473, 13.47%). All additive totals include these groups.
4. Group by legacy ward ID, calendar year and quarter, and major-trade category. Split applications by New and Renewal. Only nonempty combinations are written to the CSV. Within this extract, an absent combination means zero recorded applications; underlying citywide completeness has not been independently audited. The downloadable aggregate contains no applicant or business names, source application IDs, street addresses, or contact fields.

| Calendar year | Unique applications | Unclassified |
| --- | ---: | ---: |
| 2020 | 77,450 | 13,817 |
| 2021 | 60,619 | 9,594 |
| 2022 | 65,028 | 7,996 |
| 2023 | 72,053 | 8,271 |
| 2024 | 69,973 | 6,795 |

All five years contain records for all 198 legacy wards, across 20 calendar quarters in total. The publication includes **60,856 new applications and 284,267 renewal applications** distributed across 19,502 nonzero aggregate cells. The unknown-category share changes across years. Interpret changes in a named category alongside the movement in unknown categories. The first quarter accounts for a particularly large share of recorded applications in every year. Compare corresponding seasonal periods when investigating quarterly changes.

## Reproduce

With Python 3.11 or later, run the following after substituting project paths if needed. The optional first argument allows offline reproduction using the original gzip. Omitting it downloads the public source to a temporary directory. The script validates the source checksum and writes only aggregate counts and coverage metadata.

```sh
python aggregate_bbmp.py --source source.csv.gz --crosswalk ward-crosswalk.csv --output reproduced
```

The published subset is a cross-section of a later historical extract. Tests on an earlier time period still use a retrospectively assembled source. Real-time reporting delays, incomplete records or later corrections may reduce performance in operation. Use the results to investigate recorded patterns. Establishing whether conditions changed for businesses requires independent follow-up.
