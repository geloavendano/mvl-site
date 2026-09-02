-- Mark players who appeared in MVL 2024 or 2025, so the Fresh New Player of the
-- League award can exclude them.
--
-- Matched from the client's roster export against mvl.players.display_name.
-- Tiers used, strongest first: exact; surname + first given name (covers
-- "Paul Andy Yiu" vs "Paul Yiu"); reversed CSV columns; a tight similarity
-- threshold for typos; and surname + a given name that sits mid-string in the
-- export ("Onyl Canson" for "Andre Onyl Canson").
--
-- Two guards worth knowing:
--   * SSVC has both a Christian and an Anthony Arbasto and the export has only
--     "Christian Anthony Arbasto". Christian takes it; Anthony is treated as new.
--   * Several players sit on both their team and the Organizer roster, so the
--     same name legitimately matches twice — both rows are marked.
--
-- Apply individually, NOT with `supabase db push`.

alter table mvl.players add column if not exists is_repeat boolean not null default false;
comment on column mvl.players.is_repeat is
  'Played in MVL 2024 or 2025. Excluded from Fresh New Player of the League.';

update mvl.players set is_repeat = false;

update mvl.players set is_repeat = true
where id in (
    '27cc1534-2cfa-4bd0-99b4-2c1438879166'::uuid,  -- Bryan Cruz                 <- Bryan Cruz [exact]
    '4daa0cc2-8af2-442a-bdfe-1d8d4de7ccb6'::uuid,  -- Bryan Cruz                 <- Bryan Cruz [exact]
    'b00db1df-2057-4c39-b37e-72bc2e046cc2'::uuid,  -- Bubbles Sumalinog          <- Bubbles Sumalinog [exact]
    'db51d32b-7f14-4d9d-ad19-accde8cd5784'::uuid,  -- Chad Abrahan               <- Chad Abrahan [exact]
    'dd6b2b55-b467-41a8-804b-86a69b81f7a6'::uuid,  -- Chan dela Cruz             <- Chan Dela Cruz [exact]
    'd5d1569e-bba5-4061-8686-42c240062018'::uuid,  -- Chloe Tiu                  <- Chloe Tiu [exact]
    'f9cbf127-cf03-4731-b0a5-c0bc0853741e'::uuid,  -- Christian Arbasto          <- Christian Anthony Arbasto [first+last]
    '23d14364-f3cd-4263-aef4-bccc9502494e'::uuid,  -- Christian Ray Soco         <- Christian Soco [first+last]
    'eac1ad61-2c74-4d99-aafb-e6fb2bf39471'::uuid,  -- Christopher Suarez         <- Christopher Suarez [exact]
    'cccf0fc9-a780-4923-85f4-606b69badfa0'::uuid,  -- Dan Posadas                <- Dan Posadas [exact]
    'eb653bd8-90be-416e-99c9-c2c08bb6ed00'::uuid,  -- Dennis Mendenilla          <- Dennis Mendenilla [exact]
    '5a3819db-8777-4b82-adfc-45d16844f3e2'::uuid,  -- Earl Spencer Bocalan       <- Earl Spencer Bocalan [exact]
    'f6194aa8-93f4-4b60-9b26-c57deb095312'::uuid,  -- Errol Uy                   <- Errol Uy [exact]
    '6450e770-46dc-4d70-b49e-96613419e994'::uuid,  -- Gee Hann Manero            <- Gee Hann Manero [exact]
    '40ee1dc3-59db-44eb-a852-efa8824776e4'::uuid,  -- Gelo Avendaño              <- Gelo Avendaño [exact]
    'a80fd09d-3ad5-4a3f-8ead-98c90f9e1240'::uuid,  -- Genesis Redido             <- Genesis Redido [exact]
    '5b448827-dd8d-4407-8703-041cca9df334'::uuid,  -- Gerard Betonio             <- Gerard Joshua Betonio [first+last]
    '49e81b94-f1d2-4996-b68c-c27cd8df2c97'::uuid,  -- Glen Dela Cruz             <- Glen Dela Cruz [exact]
    'd45aab13-58ef-4145-a967-8ecfc7377755'::uuid,  -- Helson Secretaria          <- Helson Secretaria [exact]
    'a80a7b6a-894b-4230-b244-4cd8c62f4166'::uuid,  -- Hillarry Hipolito          <- Hillarry Hipolito [exact]
    'fc766a30-55b5-47dc-8458-d16caf959020'::uuid,  -- JM Asis                    <- Asis JM [reversed]
    '6e18404b-7e38-443e-98dd-34857116d40c'::uuid,  -- Jay Vee Loresto            <- Jay Vee Loresto [exact]
    'e3791177-91f0-41ee-948b-37a6d4547578'::uuid,  -- Jerome Requioma            <- Jerome Enrico Requioma [first+last]
    '7ad41ef6-5c39-44d0-a7fb-655424539f7f'::uuid,  -- Joel Mediana               <- Joel Mediana [exact]
    'ef45b44c-ee2b-4923-8dc4-95acfdbb9e5f'::uuid,  -- Johnsen Timbreza           <- Johnsen “Sen” Timbreza [first+last]
    '4ae3e31a-860c-4f03-9b26-652f99ac9d51'::uuid,  -- Jonathan Javier            <- Nathan Javier [fuzzy]
    'f2ab8c5c-2521-4837-b06f-9239987de19a'::uuid,  -- Kenj So                    <- Kenj So [exact]
    '759b80e6-a30a-4bb0-afd2-f6b13a157517'::uuid,  -- Kyle King                  <- Kyle Jullian King [first+last]
    'e9331183-899a-4a4d-9404-80557d04a3e0'::uuid,  -- Leeroy Leone               <- Leeroy Leone [exact]
    'c0520cee-902e-4486-956d-be57b0f3e391'::uuid,  -- MJ Livi Pagaran            <- MJ Livi Pagaran [exact]
    'e0dcbd78-2309-499c-827c-fbe976e127ec'::uuid,  -- Marco Lao                  <- Marco Lao [exact]
    '54e0649b-d9c0-4317-9035-e783a985887a'::uuid,  -- Mark Valerio               <- Mark Luis Valerio [first+last]
    'bc9b9810-5c97-4a21-a2bc-1cf1377b80b1'::uuid,  -- Nashim Ramos               <- Nashim Hassan Ramos [first+last]
    '845c2aad-39be-4012-be33-c96599372d2c'::uuid,  -- Nathaniel Francisco        <- Adrian Nathaniel Francisco [middle-name]
    'd4557248-12cc-4ee9-8c26-a0db1bb7adbd'::uuid,  -- Nathaniel Hipolito         <- Nathaniel Chris Hipolito [first+last]
    'e5d6611b-b6b0-4b6d-9f34-6c6e5c917350'::uuid,  -- Neil Villanueva            <- Neil Villanueva [exact]
    '57e16c00-8074-4932-bc05-57fc7cfb2fa1'::uuid,  -- Nigel San Juan             <- Nigel San Juan [exact]
    '8a980ed8-ad0a-4c21-8676-95d5de482476'::uuid,  -- Onyl Canson                <- Andre Onyl Canson [middle-name]
    '14db53f5-db97-47c0-b635-47ef2fbbebb7'::uuid,  -- Paolo Ancheta              <- Paolo Ancheta [exact]
    'a772cb25-9a71-4dae-86b1-b0ed5bd160d1'::uuid,  -- Paolo Garcia               <- Paolo Garcia [exact]
    '6d16ebff-a9a6-458a-9e0e-9ca7b0ffe75b'::uuid,  -- Paolo Retiro               <- Paolo Retiro [exact]
    '1f74f29e-5578-4e2d-aa1b-c32ed29293f1'::uuid,  -- Patrick Balse              <- Patrick Theodore Balse [first+last]
    '599d5aad-f0b0-41a8-b8f3-48cbe090186d'::uuid,  -- Paul Yiu                   <- Paul Andy Yiu [first+last]
    '8dab2674-a553-43a3-bafc-2a5a9bf9d5ea'::uuid,  -- Peter Cam                  <- Peter Cam [exact]
    '9e9bfe6a-9856-45f1-9990-f6c9dea1c349'::uuid,  -- Peter Cam                  <- Peter Cam [exact]
    '9712e844-05fc-4c92-9a46-29acf912c096'::uuid,  -- Rica Jane Enclona          <- Rica Jane Enclona [exact]
    'bf95eb3c-1d81-4ae0-810a-992c343f415f'::uuid,  -- Rica Salomon               <- Rica Salomon [exact]
    '53b95b07-d895-4cdb-9867-2ac2c9089f60'::uuid,  -- Rysell Villarte            <- Rysell Cris Villarte [first+last]
    'e3f59645-58af-4043-b571-de9ce7213440'::uuid,  -- Shanty Boncales            <- Shanty James Boncales [first+last]
    'f6c609a7-798d-4fea-84c4-c5e3969e5536'::uuid   -- Tom Ciriaco                <- Tom Ciriaco [exact]
);
