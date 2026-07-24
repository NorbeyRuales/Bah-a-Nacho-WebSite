begin;

alter table public.brands
  add constraint brands_slug_length
    check (char_length(slug) <= 120) not valid,
  add constraint brands_description_length
    check (description is null or char_length(description) <= 1000) not valid,
  add constraint brands_logo_url_format
    check (
      logo_url is null
      or (
        char_length(logo_url) <= 2048
        and logo_url ~ '^https://[^[:space:]]+$'
      )
    ) not valid;

comment on constraint brands_logo_url_format on public.brands
  is 'Los logos nuevos deben usar HTTPS; la restricción no reescribe datos históricos.';

commit;
