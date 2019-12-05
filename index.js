const Firestore = require('@google-cloud/firestore');
const PROJECT_ID = 'hirefrank-job-tracker';
const COLLECTION_NAME = 'jobs';
const firestore = new Firestore({
    projectId: PROJECT_ID,
    timestampsInSnapshots: true,
});
const request = require('request');
const csv = require('csv-parser');
const fs = require('fs');

var today = new Date();

function readAndImportCsv() {
    fs.createReadStream('jobs.csv')
        .pipe(csv())
        .on('data', (row) => {
            //console.log(row);
            var jobId = row['ID'];
            var _row = {
                id:jobId,
                company:row['COMPANY'],
                title:row['TITLE'],
                department:row['DEPARTMENT'],
                location:row['LOCATION'],
                first_seen: row['FIRST SEEN'],
                last_seen: row['LAST SEEN'],
                days_open: row['DAYS OPEN'],
                url: row['URL']
            };
            addRowToFirestore(jobId, _row);
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
        });
}

function addRowToFirestore(jobId, row) {
    firestore.doc(COLLECTION_NAME+'/'+jobId)
        .set(row)
        .then(doc => {
            //console.log('Row added');
        }).catch(err => {
        console.error(err);
    });
}

function getPostings(company, type) {
    if (type == 'greenhouse') getGreenhousePostings(company);
    if (type == 'lever') getLeverPostings(company);
}

function getGreenhousePostings(company) {
    var lowercase_c = company.toLowerCase().replace(' ','');
    var url = 'https://api.greenhouse.io/v1/boards/' + lowercase_c + '/embed/jobs?content=true';
    var options = {'json' : true};

    request(url, options, (error, res, body) => {
        if (error) {
            return  console.log(error)
        };

        if (!error && res.statusCode == 200) {
            var jobs = body.jobs;

            for (j in jobs){
                var current_job_id = lowercase_c + '::' + jobs[j].id;
                var updated_at = parseISOString(jobs[j].updated_at);
                var jobId = lowercase_c +'::' + jobs[j].id;

                var departmentName = '';
                if(jobs[j].departments.length > 0) {
                    departmentName = jobs[j].departments[0].name.trim();
                }

                var row = {
                    id:jobId,
                    company:company,
                    title:jobs[j].title.trim(),
                    department:departmentName, // could be multiple departments
                    location:jobs[j].location.name.trim(),
                    first_seen: formatDate(updated_at),
                    last_seen: formatDate(today),
                    days_open: calculateDaysOpen(today, updated_at),
                    url: jobs[j].absolute_url
                };
                addRowToFirestore(jobId, row);
            }
        };
    });
}

function getLeverPostings(company) {
    var lowercase_c = company.toLowerCase();
    var url = 'https://api.lever.co/v0/postings/' + lowercase_c + '?mode=json';
    var options = {'json' : true};

    request(url, options, (error, res, body) => {
        if (error) {
            return console.log(error)
        };

        if (!error && res.statusCode == 200) {
            var jobs = body;
            for (j in jobs) {
                var jobId = lowercase_c + '::' + jobs[j].id;
                var created_at = new Date(jobs[j].createdAt);
                var row = {
                    id: jobId,
                    company: company,
                    title: jobs[j].text.trim(),
                    department: jobs[j].categories.department.trim(),
                    location: jobs[j].categories.location.trim(),
                    first_seen: formatDate(created_at),
                    last_seen: formatDate(today),
                    days_open: calculateDaysOpen(today, created_at),
                    url: jobs[j].hostedUrl
                };
                addRowToFirestore(jobId, row);
            }
        }
    });
}

function parseISOString(iso) {
    var b = iso.split(/\D+/);
    return new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]));
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function calculateDaysOpen(last_seen, first_seen) {
    var days = Math.floor(Math.floor(last_seen.getTime() - first_seen.getTime()) / (1000 * 60 * 60 * 24));
    return days;
}

exports.getJobs = (req, res) => {
    // just for the first time,  import previous jobs from client's provided csv
    //readAndImportCsv();

    firestore.collection('companies')
        .listDocuments()
        .then(companies => {
            for(var i in companies) {
                companies[i].get().then(company => {
                    var companyName = company.get('name');
                    var companyType = company.get('type');
                    getPostings(companyName, companyType);
                });
            }
        }).catch(err => {
        console.error(err);
    });
};
