# Research basis for Layover's risk model

Summaries are paraphrased. IDs (E1, E2…) are referenced from requirements, design and code comments.

| ID | Finding (paraphrased) | Source | How Layover uses it |
|---|---|---|---|
| E1 | Migration size, building light output and wind were the top predictors of collision deaths over 20 years at a Chicago building. Halving lit window area cut collisions about 11× (spring) and 6× (fall). | Van Doren et al. 2021, PNAS | Migration is the largest weight. Lit glass beats height. |
| E2 | In NYC, unfavorable winds and poor visibility raised collisions, mostly on heavy-migration nights. Fall: S/W winds and low cloud ceilings. Spring: N/W winds and low visibility (low visibility alone ~3×). | Chen et al. 2024, J. Applied Ecology | Season-specific wind rules. Clouds and fog multiply risk on busy nights. |
| E3 | Radar-measured migration traffic predicted nightly window collisions in Oklahoma. | Elmore et al. 2021, J. Applied Ecology | Radar/forecast migration volume is a valid input. |
| E4 | In Minneapolis, collisions rose with weather that favors migration and with weather that turns bad mid-night (e.g. tailwind early, headwind by dawn). Conditions 2–3 nights earlier mattered. | Lao et al. 2022, Ornithological Applications | Carry-over from previous nights. Flag wind shifts before dawn. |
| E5 | Over 20 years in two cities, 15% of days caused 50% of seasonal deaths. Fall daily rates were ~2× spring. Dawn weather predicted risk best. | Scott et al. 2023, Ecology and Evolution | Surge slots on a few nights. Fall multiplier. |
| E6 | In downtown Minneapolis, four buildings (including a stadium) caused a large share of collisions. Glass area and nearby vegetation increased collisions. | Loss et al. 2019, PLoS ONE | Stadiums are hotspots. Glass near trees ranks higher. |
| E7 | Area of glass emitting light at night was the strongest factor at 48 Minneapolis facades, independent of total glass. | Lao et al. 2019, Biological Conservation | Rank "unpatrolled spots" by lit glass. |
| E8 | NYC's Tribute in Light beams concentrated birds at >20× normal density, up to 4 km high. Effects stopped when lights went off. | Van Doren et al. 2017, PNAS | Big light sources (stadiums, beams, shows) are major hazards. |
| E9 | Species that use nocturnal flight calls collide more than their abundance predicts (Chicago, Cleveland, 40 yrs). | Winger et al. 2019, Proc. R. Soc. B | Species suggestions favor flight-calling passerines. |
| E10 | Under overcast skies, steady white/green/blue light attracted more birds than red or blinking light. | Rebke et al. 2019, Biological Conservation | Lit-venue weight rises under low clouds. |
| E11 | Low cloud layers pushed migrants lower and toward city lights. | Weisshaupt et al. 2022, Remote Sensing | Low ceiling increases light attraction. |
| E12 | Skyglow strongly predicted where migrants stop over across the US. | Horton et al. 2023, Nature Communications | Dawn counts in lit-city parks after big nights. |
| E13 | Migration intensity can be forecast 1–7 days ahead from weather (up to 81% of variation explained). | Van Doren & Horton 2018, Science | Forecast-driven alerts are feasible. |
| E14 | In China, shorter, glassier buildings had more collisions. Trees within 5 m of buildings were linked to fewer. | Li et al. 2025, Biological Conservation | Height is a weak signal. Don't over-weight it. |
| E15 | On a low-rise Cleveland campus (buildings under 30 m, Lake Erie shore), 271 dead birds of 50 species were found over 12 months. About 90% of deaths came in spring and fall migration. Warblers and sparrows made up about two-thirds of deaths. Facades with more glass, and windows with trees within 5 m or reflecting trees, had more deaths. Facade compass direction did not matter. | Cleveland campus study 2020 (authors and venue not given in the Consensus record) | Ohio evidence that glass share beats height, even on short buildings. Supports lake-shore migrant-season weighting. Tree reflection backs the vegetation rule. |
| E16 | In northwestern Illinois, collisions at 20 buildings rose with window area and fell with surrounding development. Juveniles collided more than adults. Predicted annual deaths varied from 0 to 52 per building. | Hager et al. 2013, PLoS ONE | Per-building risk varies a lot, so rank spots individually. Glass area is a core input. |
| E17 | In Minneapolis, most spring American woodcock collisions (11 of 15) came during two snowstorms. Collisions followed strong north winds and a low cloud base two nights earlier. | Loss et al. 2020, Wildlife Biology | Severe-weather spikes in spring. Lagged low-cloud signal supports multi-night carry-over (E4). |

| E18 | Chicago GIS project using 40 years of Field Museum specimens, 3D building models, luminosity and Doppler radar. The abstract states hypotheses (tall, bright buildings near Lake Michigan have more strikes) and reports no results. | Muenchow 2026, Research Days (abstract only) | Data lead and Chicago context. Changes no weight. Height stays weak (E14) until the results are read. |
| E19 | Estimates of 388 to 965 million US building-collision deaths a year. Light attracts and disorients birds. Bird-safe glass and lighting reductions exist. | Farnsworth et al. 2024, PNAS (commentary) | Background for coordinator messaging only. Not used in scoring. Never shown as a prediction. |
| E20 | Two decades of radar and satellite data show where and when the most migrants are exposed to light pollution across the contiguous US. | Horton et al. 2019, Frontiers in Ecology and the Environment | Supports lit-city and season timing. Basis for a later skyglow layer (E12). Not used for weights in v0.1. |
| E21 | Review: window collisions are a leading source of wild bird mortality. Lights and vegetation draw birds near windows. Treated glass prevents collisions. | Klem 2025, The Wilson Journal of Ornithology | Context. Supports the product rule that mitigation is about glass and lights, not about handling birds. |
| E22 | McCormick Place Lakeside (Chicago) had markers added to 120,000 sq ft of glass in summer 2024, covering 6 to 8% of the surface, and has closed drapes and dimmed non-essential lights overnight since October 2023. Fewer than 20 deaths were recorded in fall 2024, against more than 1,000 on one night in October 2023. Reports describe a drop of more than 95%. | WTTW 2025-01-09 (Field Museum data), Cornell Lab, McCormick Place. News and organization reports, not peer reviewed. | Treated glass sharply cuts collisions. The bird-safe treatment input discounts the glass contribution, kept below the reported drop. The 2000 to 2020 dataset describes the building before treatment. |
| E23 | Any building with hazardous lighting, transparent or reflective glass, and attractive landscaping near windows or lobbies can be dangerous. There is no single worst building. | Chicago Bird Collision Monitors FAQ (organization, not peer reviewed) | Supports modelling lights, glass and plantings together. A fixed list of hotspots is not enough. |
## Where studies disagree
- E2 found low visibility and low clouds raised risk. E5 found clear, cool fall days were worst. Treat "big flight" as the dependable signal and weather as a modifier.
- Most evidence comes from single cities in the Northern Hemisphere. Weights in Layover are a heuristic until calibrated with local finds.

## Full references
- Van Doren BM et al. (2021) Drivers of fatal bird collisions in an urban center. PNAS.
- Chen K et al. (2024) Heavy migration traffic and bad weather are a dangerous combination: Bird collisions in New York City. Journal of Applied Ecology.
- Elmore JA et al. (2021) Predicting bird-window collisions with weather radar. Journal of Applied Ecology.
- Lao S et al. (2022) Bird–building collisions increase with weather conditions that favor nocturnal migration and with inclement and changing weather. Ornithological Applications.
- Scott KM et al. (2023) What causes bird-building collision risk? Seasonal dynamics and weather drivers. Ecology and Evolution.
- Loss SR et al. (2019) Factors influencing bird-building collisions in the downtown area of a major North American city. PLoS ONE.
- Lao S et al. (2019) The influence of artificial light at night and polarized light on bird-building collisions. Biological Conservation.
- Van Doren BM et al. (2017) High-intensity urban light installation dramatically alters nocturnal bird migration. PNAS.
- Winger BM et al. (2019) Nocturnal flight-calling behaviour predicts vulnerability to artificial light in migratory birds. Proc. R. Soc. B.
- Rebke M et al. (2019) Attraction of nocturnally migrating birds to artificial light: colour, intensity and blinking mode under different cloud cover. Biological Conservation.
- Weisshaupt N et al. (2022) Anthropogenic illumination as guiding light for nocturnal bird migrants identified by remote sensing. Remote Sensing.
- Horton KG et al. (2023) Artificial light at night is a top predictor of bird migration stopover density. Nature Communications.
- Van Doren BM, Horton KG (2018) A continental system for forecasting bird migration. Science.
- Li BV et al. (2025) Scale-dependent effects of urban vegetation and artificial lights at night on bird-building collisions in China. Biological Conservation.
- Cleveland campus study (2020) Seasonal, taxonomic, and local habitat components of bird-window collisions on an urban university campus in Cleveland, OH. Authors and venue not listed in the Consensus record; confirm before citing externally.
- Hager SB et al. (2013) Window area and development drive spatial variation in bird-window collisions in an urban landscape. PLoS ONE.
- Loss SR et al. (2020) Inclement weather and American woodcock building collisions during spring migration. Wildlife Biology.
- Muenchow R (2026) Geographical Information Systems: Abundance of Bird Strikes in Chicago is Influenced by Building Height and Luminosity. Research Days. Abstract only; confirm the results before citing.
- Farnsworth A et al. (2024) To mitigate bird collisions, enforce the Migratory Bird Treaty Act. PNAS.
- Horton KG et al. (2019) Bright lights in the big cities: migratory birds' exposure to artificial light. Frontiers in Ecology and the Environment.
- Klem D (2025) Bird-window collisions: a critical review. The Wilson Journal of Ornithology.
- WTTW News (2025) Bird-friendly glass at McCormick Place is working as deadly collisions drop 95%, data shows. News report.
- Chicago Bird Collision Monitors. Frequently asked questions. Organization website.
