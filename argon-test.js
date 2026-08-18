const Argon = require("argon2");

async function benchmark(count) {
    const password = "Super@123";
    const hash = await Argon.hash(password);

    const start = performance.now();

    const jobs = [];

    for (let i = 0; i < count; i++) {
        jobs.push(Argon.verify(hash, password));
    }

    await Promise.all(jobs);

    const end = performance.now();

    console.log(
        `${count} concurrent verifies: ${(end - start).toFixed(2)} ms`
    );
}

async function main() {
    await benchmark(10);
    await benchmark(50);
    await benchmark(100);
}

main();