import { utils, getData, verifySignature } from "@govtechsg/open-attestation";
import express from 'express';

var app = express();

app.use(express.urlencoded({extended: true}));
app.use(express.json()) 

app.listen(3001, () => {
    console.log("Server running on port 3001");
});

app.post("/", (req, res, next) => {

    const jsonData = req.body
    if (!(utils.isWrappedV2Document(jsonData))) {
        res.json({
            status: "Invalid",
            reason: "Wrong Format"
        })
        return;
    }

    const certValid = verifySignature(jsonData);
    if (!certValid) {
        res.json({
            status: "Invalid",
            reason: "Could not verify signature"
        });
        return;
    }

    const certData = getData(req.body);
    if (certData.name !== "VaccinationHealthCert") {
        res.json({
            status: "Invalid",
            reason: `Certificate name unrecognized: ${certData.name}`
        });
        return;
    }

    const issuedByMoh = certData.issuers.filter((issuer) => issuer.name === 'MINISTRY OF HEALTH (SINGAPORE)').length;
    if (issuedByMoh == 0) {
        res.json({
            status: "Invalid",
            reason: "Certificate not issued by MOH"
        });
        return;
    }

    const patientData = certData.fhirBundle.entry.filter((obj) => obj.resourceType === 'Patient')[0];
    if (patientData === null) {
        res.json({
            status: "Invalid",
            reason: "Certificate not does not contain patient data"
        });
        return;
    }

    const patientName = patientData.name[0].text;
    if (patientName == null || patientName == "") {
        res.json({
            status: "Invalid",
            reason: "Certificate not does not contain patient name"
        });
        return;
    }

    const patientBirthDate = patientData.birthDate;
    if (patientBirthDate == null || patientBirthDate == "") {
        res.json({
            status: "Invalid",
            reason: "Certificate not does not contain patient birthdate"
        });
        return;
    }

    const recommendation = certData.fhirBundle.entry.filter((obj) => obj.resourceType === 'ImmunizationRecommendation')[0];
    const recommendationDate = recommendation.recommendation[0].dateCriterion.slice(-1)[0].value;
    const recommendationStatus = recommendation.recommendation[0].forecastStatus.coding.slice(-1)[0].code;
    if (recommendationDate == "" || recommendationStatus == "") {
        res.json({
            status: "Invalid",
            reason: "Certificate not does not vaccination recommendation information"
        });
        return;
    }

    const immunizations = certData.fhirBundle.entry.filter((obj) => obj.resourceType === 'Immunization')
    const vaccinationDates = [];
    for (let immunization of immunizations) {
        vaccinationDates.push(immunization.occurrenceDateTime)
    }
    if (vaccinationDates < 1) {
        res.json({
            status: "Invalid",
            reason: "Certificate does not show at least one vaccination."
        });
        return;
    }

    res.json({
        status: "Valid",
        patientName,
        patientBirthDate,
        recommendationDate,
        recommendationStatus,
        vaccinationDates
    });
});