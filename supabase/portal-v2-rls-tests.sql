-- Test only. Execute inside BEGIN + migration SQL + this file + ROLLBACK.
-- Fixture users are never committed. No email is sent.
INSERT INTO auth.users(id,email,aud,role,encrypted_password,email_confirmed_at,created_at,updated_at)
VALUES
('00000000-0000-4000-8000-000000000002','fixture.portal2@example.invalid','authenticated','authenticated','',now(),now(),now()),
('00000000-0000-4000-8000-000000000003','fixture.portal3@example.invalid','authenticated','authenticated','',now(),now(),now());

INSERT INTO public.portal_members(user_id) VALUES('00000000-0000-4000-8000-000000000002');
INSERT INTO public.portal_profiles(user_id,display_name) VALUES('00000000-0000-4000-8000-000000000002','Compañero Temporal');

SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.portal_roles WHERE role='admin' LIMIT 1),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $admin_check$
DECLARE uid uuid; pid uuid; vid integer;
BEGIN
 uid:=auth.uid();
 IF NOT public.portal_is_member() THEN RAISE EXCEPTION 'ADMIN_MEMBERSHIP_FAIL'; END IF;
 INSERT INTO public.portal_profiles(user_id,display_name) VALUES(uid,'Alumno Temporal');
 INSERT INTO public.portal_messages(sender_id,recipient_id,body)
 VALUES(uid,'00000000-0000-4000-8000-000000000002','Mensaje académico privado');
 IF (SELECT count(*) FROM public.portal_messages WHERE sender_id=uid)<>1 THEN RAISE EXCEPTION 'SENDER_CANNOT_READ_DM'; END IF;
 INSERT INTO public.portal_polls(question,options,created_by)
 VALUES('¿Actividad de curso?','["Paseo","Deporte"]'::jsonb,uid) RETURNING id INTO pid;
 INSERT INTO public.portal_poll_votes(poll_id,user_id,choice) VALUES(pid,uid,0);
 IF (SELECT sum(votes) FROM public.portal_poll_results(pid))<>1 THEN RAISE EXCEPTION 'INVALID_AGGREGATE'; END IF;
 INSERT INTO public.portal_personal_state(user_id,data)
 VALUES(uid,'{"tasks":[],"notes":"nota privada"}'::jsonb);
 INSERT INTO public.portal_daily_visits(user_id,visit_day)
 VALUES(uid,(now() at time zone 'America/Santiago')::date);
END $admin_check$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $recipient_check$
DECLARE mid uuid;
BEGIN
 IF NOT public.portal_is_member() THEN RAISE EXCEPTION 'MEMBER_NOT_RECOGNIZED'; END IF;
 SELECT id INTO mid FROM public.portal_messages LIMIT 1;
 IF mid IS NULL THEN RAISE EXCEPTION 'RECIPIENT_CANNOT_READ_DM'; END IF;
 INSERT INTO public.portal_message_reports(message_id,reporter_id,reason)
 VALUES(mid,auth.uid(),'Reporte académico de prueba');
 IF (SELECT count(*) FROM public.portal_message_reports WHERE message_id=mid)<>1 THEN RAISE EXCEPTION 'REPORT_NOT_VISIBLE'; END IF;
END $recipient_check$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $outsider_check$
BEGIN
 IF public.portal_is_member() THEN RAISE EXCEPTION 'OUTSIDER_IS_MEMBER'; END IF;
 IF (SELECT count(*) FROM public.portal_messages)<>0 THEN RAISE EXCEPTION 'PRIVATE_MESSAGE_LEAK'; END IF;
 IF (SELECT count(*) FROM public.portal_message_reports)<>0 THEN RAISE EXCEPTION 'PRIVATE_REPORT_LEAK'; END IF;
 IF (SELECT count(*) FROM public.portal_personal_state)<>0 THEN RAISE EXCEPTION 'PRIVATE_SNAPSHOT_LEAK'; END IF;
 IF (SELECT count(*) FROM public.portal_polls)<>0 THEN RAISE EXCEPTION 'POLL_DATA_LEAK'; END IF;
END $outsider_check$;

SET LOCAL ROLE anon;
DO $guest_check$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.portal_messages;
  RAISE EXCEPTION 'ANON_DM_READ_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM count(*) FROM public.portal_polls;
  RAISE EXCEPTION 'ANON_POLL_READ_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $guest_check$;
