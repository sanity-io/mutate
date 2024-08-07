# Changelog

## [0.8.0](https://github.com/sanity-io/mutate/compare/mutate-v0.7.1...mutate-v0.8.0) (2024-08-07)


### Features

* add compact formatter ([04f5ee1](https://github.com/sanity-io/mutate/commit/04f5ee10faf7fac891b01d7577907ffc6bfd47cd))
* add low level store implementation ([01ee65e](https://github.com/sanity-io/mutate/commit/01ee65ef39d09f89b7cc63fc094e5c3f384217c1))
* export unstable store ([c2310ef](https://github.com/sanity-io/mutate/commit/c2310ef559f65ba8579f4923086032f83bc5eab7))
* improve type system for patching values, use stricter types when possible ([61a8134](https://github.com/sanity-io/mutate/commit/61a81340f1c45a60dd007dea09ddc330c4cb94f4))
* **path:** export getAtPath w/types ([3197968](https://github.com/sanity-io/mutate/commit/31979684615995dc01e227cbd9f6ffe2add60c82))
* **store:** export unstable_store ([d2245ee](https://github.com/sanity-io/mutate/commit/d2245ee8615d24ccbafe22395033a6cd21965172))
* **store:** expose meta streams ([63bcaac](https://github.com/sanity-io/mutate/commit/63bcaac938d6bb01195346c5acc8e756e7cfde41))
* **store:** start implementation of cl-store ([02d7e48](https://github.com/sanity-io/mutate/commit/02d7e485e48bdfd59d51ebf12c36762e45b35b60))


### Bug Fixes

* add missing exports ([555e238](https://github.com/sanity-io/mutate/commit/555e238736ff67892452db71d480cd0a744a5f39))
* add missing exports ([c36c6cb](https://github.com/sanity-io/mutate/commit/c36c6cb9a46886cf1f60a218c38f03a921d2e486))
* add missing mutations to decoders/encoders ([4456797](https://github.com/sanity-io/mutate/commit/4456797b4cf0daf278fec6c11d46856fecbfb47c))
* add typesversions workaround for unstable store export ([5b12b06](https://github.com/sanity-io/mutate/commit/5b12b06c6815197ae069b6660708cb5b2fb7997c))
* **apply:** add type support for inc operation ([7a6b814](https://github.com/sanity-io/mutate/commit/7a6b814f98040a4d091c9f6c852df8a3be920bec))
* cleanup main exports ([a25b833](https://github.com/sanity-io/mutate/commit/a25b833678da6e8a453c4bfaf514e000f0491336))
* **deps:** add missing dependencies ([587582f](https://github.com/sanity-io/mutate/commit/587582f1a69058d0b9bff0f0362a61e2cc2dfbd0))
* **deps:** add required dependencies ([8b6c650](https://github.com/sanity-io/mutate/commit/8b6c65030ed2a323b6500ed1417e2816cc49f204))
* **deps:** replace nanoid with ulid ([b7f73fa](https://github.com/sanity-io/mutate/commit/b7f73face04fe02b35c06ae48d606d65b6bf2ec1))
* **deps:** upgrade dependencies ([cc7fe9d](https://github.com/sanity-io/mutate/commit/cc7fe9d9dade62936326c529c3f9413f7ec87db2))
* **deps:** upgrade dependencies ([8488bd9](https://github.com/sanity-io/mutate/commit/8488bd91bffa9a7a4387a9ed1840a895a684f945))
* **docs:** fix readme syntax error ([4cdcf13](https://github.com/sanity-io/mutate/commit/4cdcf134d500390e7f03e2198af8445b8797215a))
* **docs:** fix tsdoc formatting ([a261922](https://github.com/sanity-io/mutate/commit/a261922c7dadef2d790dfba4502aee94e74ed2fd))
* **docs:** improve section about differences from sanity mutations ([96c4547](https://github.com/sanity-io/mutate/commit/96c4547c6e4f19db78cd051e32c57243938b0449))
* **example:** load api config from .env ([42eb4dc](https://github.com/sanity-io/mutate/commit/42eb4dc9c92d263eeb92cb82a26e9397ca1364f3))
* fix broken export ([a6800f2](https://github.com/sanity-io/mutate/commit/a6800f2a5ab6876448aabda8743be8c85bd9db9f))
* improve error messages ([87b2890](https://github.com/sanity-io/mutate/commit/87b2890b0aaae1a4dfe85385b1412c8d92b12274))
* inline mutation event ([8eb49f2](https://github.com/sanity-io/mutate/commit/8eb49f224964322f7063f541160dd981efa96193))
* issue a warning on event.mutation access if listener event didn't include them ([024a4af](https://github.com/sanity-io/mutate/commit/024a4af6c78af63a80057a2157eeaa1fdaf48e0a))
* **package:** fix broken package exports ([60dbc5d](https://github.com/sanity-io/mutate/commit/60dbc5d4693e518194237b3543e93dada5ec4f3e))
* pass ifRevisionID when encoding for Sanity mutation API ([6e7b490](https://github.com/sanity-io/mutate/commit/6e7b490a1d8ac27fb7c6c205d6ad89f19fcf7599))
* **path:** fix broken overload for getAtPath() ([3d0b12f](https://github.com/sanity-io/mutate/commit/3d0b12f4ea4c576a8abd7920ae5649aee721b857))
* **path:** reexport path index ([28d9da2](https://github.com/sanity-io/mutate/commit/28d9da28b10b32093de0ad365fe4e2e6c4bdb112))
* **pkg:** add sideEffects: false to package.json ([f2ec4ca](https://github.com/sanity-io/mutate/commit/f2ec4ca4350ea5054f116701c3da8bac2ad5b007))
* revert back to nanoid for array key generator ([40b7193](https://github.com/sanity-io/mutate/commit/40b7193778f07b8f80fc609f12fdae5147ddafe4))
* **store:** export api types ([717229b](https://github.com/sanity-io/mutate/commit/717229ba3e92d3646be29039a114c31d5edc7f5d))
* **store:** send intention-based mutations along with the mutation event ([7aeb7af](https://github.com/sanity-io/mutate/commit/7aeb7aff41b5fd5f428f536d588473b6837fbb74))
* **tests:** add tests for array utils ([e8aee45](https://github.com/sanity-io/mutate/commit/e8aee45847b948c12ff0f5717a1574da99b9f8d6))
* **test:** update snapshots ([05b739f](https://github.com/sanity-io/mutate/commit/05b739f915d6231384bafcf643dc6a148de0d3a5))
* **test:** use expectTypeOf instead of ts-expect ([00ce33d](https://github.com/sanity-io/mutate/commit/00ce33d7b7d87e5ffc1532f7488d87b131d1311f))
* **types:** add SafePath excluding path parse errors ([f9cc3c1](https://github.com/sanity-io/mutate/commit/f9cc3c113a01e19e1a9c0d13eba9c3afbbbc8760))
* **types:** fix typing issue when applying a patch in non-tuple arrays ([24eba69](https://github.com/sanity-io/mutate/commit/24eba696174c2e4b04715376f04b106d039da9c0))
