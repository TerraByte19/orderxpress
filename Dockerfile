# --- Build-Stufe: baut das ausfuehrbare JAR (Maven + JDK 21) ---
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Erst nur die pom.xml kopieren und Abhaengigkeiten laden -> Docker-Cache nutzt
# das, solange sich die pom.xml nicht aendert (schnellere Rebuilds).
COPY pom.xml .
# Abhaengigkeiten vorladen (Cache). Darf den Build nicht abbrechen, falls ein
# einzelnes Plugin hier noch nicht aufloest -> "|| true".
RUN mvn -B dependency:go-offline || true

COPY src ./src
# Tests brauchen keine echte DB im Build und kosten Zeit -> beim Deploy ueberspringen.
RUN mvn -B clean package -DskipTests

# --- Laufzeit-Stufe: nur das JRE + das fertige JAR (schlankes Image) ---
FROM eclipse-temurin:21-jre
WORKDIR /app

# Auf kleinen Instanzen (Render Free = 512 MB) den Heap an den Container koppeln.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"

COPY --from=build /app/target/*.jar app.jar

# Nur zur Doku - Render gibt den echten Port ueber $PORT vor (siehe application.yml).
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
