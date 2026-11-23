-- A release is immutable. A revised model uses a new snapshot ID.
CREATE TABLE public.ward_evidence_series (
    snapshot text NOT NULL,
    ward smallint NOT NULL CHECK (ward BETWEEN 1 AND 198),
    category smallint NOT NULL CHECK (category BETWEEN 0 AND 7),
    quarters jsonb NOT NULL CHECK (jsonb_typeof(quarters) = 'array' AND jsonb_array_length(quarters) = 20),
    parameters jsonb NOT NULL CHECK (jsonb_typeof(parameters) = 'object'),
    PRIMARY KEY (snapshot, ward, category)
);
ALTER TABLE public.ward_evidence_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ward_evidence_series FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ward_evidence_series TO anon, authenticated;
CREATE POLICY public_evidence_read ON public.ward_evidence_series
    FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.ward_evidence_series IS 'Public quarterly aggregate evidence from historical BBMP records. Contains no personal information or review notes.';
