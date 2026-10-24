CREATE FUNCTION stayease_require_room_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM reservation WHERE id = NEW.id)
       AND NOT EXISTS (SELECT 1 FROM reservation_room WHERE reservation_id = NEW.id) THEN
        RAISE EXCEPTION 'Reservation % requires at least one room line', NEW.id
            USING ERRCODE = '23514', CONSTRAINT = 'reservation_requires_room_line';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER reservation_requires_room_line
AFTER INSERT ON reservation DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stayease_require_room_line();

CREATE FUNCTION stayease_keep_room_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM reservation WHERE id = OLD.reservation_id)
       AND NOT EXISTS (SELECT 1 FROM reservation_room WHERE reservation_id = OLD.reservation_id) THEN
        RAISE EXCEPTION 'Reservation % requires at least one room line', OLD.reservation_id
            USING ERRCODE = '23514', CONSTRAINT = 'reservation_requires_room_line';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER reservation_room_line_required_on_delete
AFTER DELETE ON reservation_room DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stayease_keep_room_line();
