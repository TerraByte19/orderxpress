package com.orderxpress.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Einmalige Reparatur von Alt-Spalten: alle noch nativen ENUM-Spalten werden
 * zu VARCHAR. Zuerst nur fuer {@code restaurant_assets.kind} gebaut; am
 * 12.10.2026 zeigte sich, dass {@code staff_devices.role} dieselbe Falle hat
 * ({@code ENUM('KITCHEN','OWNER','SERVICE')} ohne WAITER - Kellner-Geraete
 * liessen sich auf der gewachsenen Datenbank nicht anlegen). Deshalb jetzt
 * generisch ueber alle Spalten statt einer festen Liste.
 *
 * <h3>Was passiert ist</h3>
 * Hibernate 7 bildet Java-Enums auf den NATIVEN Enum-Typ der Datenbank ab,
 * auch bei {@code @Enumerated(EnumType.STRING)}. In H2 entstand dadurch eine
 * Spalte vom Typ {@code ENUM('BACKGROUND','LOGO')} - mit genau diesen zwei
 * erlaubten Werten, festgeschrieben zum Zeitpunkt der ersten Erzeugung.
 *
 * Ein neuer Enum-Wert (hier {@code AssetKind.INTRO}) ist damit KEINE reine
 * Erweiterung mehr, sondern eine Schema-Aenderung - und {@code ddl-auto:
 * update} aendert bestehende Spaltentypen grundsaetzlich nicht. Der Upload
 * scheiterte deshalb auf einer gewachsenen Datenbank mit
 * {@code Wert nicht erlaubt fuer Feld "('BACKGROUND', 'LOGO')": "INTRO"},
 * waehrend alle Tests gruen blieben: die laufen gegen eine jedesmal frisch
 * erzeugte Datenbank, in der der Enum-Typ bereits alle drei Werte kennt.
 *
 * <h3>Was diese Klasse tut</h3>
 * Sie macht aus jeder Enum-Spalte eine schlichte Zeichenkette. Danach kostet
 * ein weiterer Enum-Wert wieder gar nichts. Neue Datenbanken bekommen von
 * vornherein {@code VARCHAR} (siehe {@code hibernate.type.preferred_enum_jdbc_type}
 * in der application.yml), diese Klasse ist also nur fuer bestehende Staende
 * da und laeuft dort genau einmal wirksam.
 *
 * <h3>Warum von Hand und nicht mit Flyway</h3>
 * Das Projekt hat (noch) kein Migrationswerkzeug - der Wechsel auf
 * PostgreSQL + Flyway steht als eigener Punkt auf der Liste. Diese Klasse
 * ist bewusst ein STOPGAP fuer genau diesen Altbestand und soll mit dem Umstieg auf
 * Flyway ersatzlos verschwinden. Sie ist kein Vorbild fuer weitere
 * Migrationen: die naechste gehoert in ein Migrationswerkzeug.
 *
 * Laeuft nur auf H2. Auf einer anderen Datenbank passiert nichts - dort gibt
 * es diesen Altbestand nicht, und die Anweisung saehe ohnehin anders aus.
 */
@Component
@Order(1) // vor dem DataInitializer: der legt Beispieldaten an und braucht die Spalte
public class EnumSpaltenMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EnumSpaltenMigration.class);

    private final JdbcTemplate jdbc;

    public EnumSpaltenMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        try {
            if (!istH2()) {
                return;
            }
            for (Map<String, Object> spalte : enumSpalten()) {
                String tabelle = (String) spalte.get("TABLE_NAME");
                String name = (String) spalte.get("COLUMN_NAME");
                try {
                    jdbc.execute("ALTER TABLE " + tabelle + " ALTER COLUMN " + name
                            + " SET DATA TYPE VARCHAR(50)");
                    log.info("{}.{} von ENUM auf VARCHAR(50) umgestellt - neue Enum-Werte "
                            + "brauchen dort jetzt keine Schema-Aenderung mehr.", tabelle, name);
                } catch (Exception e) {
                    // Kein Grund, den Start abzubrechen: ohne die Umstellung laeuft
                    // alles Bisherige weiter, nur neue Enum-Werte in DIESER Spalte
                    // nicht. Die Meldung muss aber laut genug sein, um sie im Log zu finden.
                    log.warn("{}.{} konnte nicht auf VARCHAR umgestellt werden - Enum-Werte, "
                            + "die beim Anlegen der Tabelle noch nicht existierten, werden dort scheitern.",
                            tabelle, name, e);
                }
            }
        } catch (Exception e) {
            log.warn("Pruefung auf alte ENUM-Spalten fehlgeschlagen.", e);
        }
    }

    /** Ueber die JDBC-Metadaten statt ueber eine information_schema-Abfrage:
     *  deren Aufbau unterscheidet sich zwischen H2-Versionen, der
     *  Produktname nicht. */
    private boolean istH2() {
        String produkt = jdbc.execute((ConnectionCallback<String>) verbindung ->
                verbindung.getMetaData().getDatabaseProductName());
        return produkt != null && produkt.toUpperCase().contains("H2");
    }

    /** ALLE noch nativen ENUM-Spalten - leer auf einer frischen Datenbank
     *  (die bekommt dank preferred_enum_jdbc_type von vornherein VARCHAR)
     *  und nach dem ersten wirksamen Lauf. */
    private List<Map<String, Object>> enumSpalten() {
        return jdbc.queryForList(
                "select table_name, column_name from information_schema.columns "
                        + "where table_schema = 'PUBLIC' and data_type = 'ENUM'");
    }
}
