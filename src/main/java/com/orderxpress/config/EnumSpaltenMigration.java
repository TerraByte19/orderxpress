package com.orderxpress.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Einmalige Reparatur einer Alt-Spalte: {@code restaurant_assets.kind}.
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
 * Sie macht aus der Enum-Spalte eine schlichte Zeichenkette. Danach kostet
 * ein weiterer Bild-Typ wieder gar nichts. Neue Datenbanken bekommen von
 * vornherein {@code VARCHAR} (siehe {@code hibernate.type.preferred_enum_jdbc_type}
 * in der application.yml), diese Klasse ist also nur fuer bestehende Staende
 * da und laeuft dort genau einmal wirksam.
 *
 * <h3>Warum von Hand und nicht mit Flyway</h3>
 * Das Projekt hat (noch) kein Migrationswerkzeug - der Wechsel auf
 * PostgreSQL + Flyway steht als eigener Punkt auf der Liste. Diese Klasse
 * ist bewusst ein STOPGAP fuer genau einen Fall und soll mit dem Umstieg auf
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
            String typ = spaltenTyp();
            if (typ == null) {
                return; // Tabelle gibt es noch nicht - frischer Stand, nichts zu tun
            }
            // H2 meldet Zeichenketten als "CHARACTER VARYING". Alles andere
            // (also "ENUM") ist der Altbestand, den wir umstellen wollen.
            if (typ.toUpperCase().startsWith("CHARACTER")) {
                return;
            }
            jdbc.execute("ALTER TABLE restaurant_assets ALTER COLUMN kind SET DATA TYPE VARCHAR(20)");
            log.info("restaurant_assets.kind von {} auf VARCHAR(20) umgestellt - neue Bild-Arten "
                    + "brauchen jetzt keine Schema-Aenderung mehr.", typ);
        } catch (Exception e) {
            // Kein Grund, den Start abzubrechen: ohne die Umstellung laeuft
            // alles Bisherige weiter, nur das Vorhang-Bild nicht. Die Meldung
            // muss aber laut genug sein, um sie im Log zu finden.
            log.warn("restaurant_assets.kind konnte nicht auf VARCHAR umgestellt werden - "
                    + "das Hochladen eines Vorhang-Bildes wird auf dieser Datenbank scheitern.", e);
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

    /** Datentyp der Spalte, oder null wenn es Tabelle/Spalte (noch) nicht gibt. */
    private String spaltenTyp() {
        List<String> typen = jdbc.queryForList(
                "select data_type from information_schema.columns "
                        + "where table_name = 'RESTAURANT_ASSETS' and column_name = 'KIND'", String.class);
        return typen.isEmpty() ? null : typen.get(0);
    }
}
