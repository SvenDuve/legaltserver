
This creates a snapshot from an existing volume. The snapshot can be used to create a new volume or restore an existing volume to a previous state.

```bash
fly postgres create --snapshot-id vs_zQpa3DVD0nAI35k7J72DgQB --image-ref flyio/postgres-flex:15.3
```

output:

```bash
Postgres cluster still-wood-6574 created
  Username:    postgres
  Password:    c0AKZUmSA6HdVsM
  Hostname:    still-wood-6574.internal
  Flycast:     fdaa:3:161a:0:1::5
  Proxy port:  5432
  Postgres port:  5433
  Connection string: postgres://postgres:c0AKZUmSA6HdVsM@still-wood-6574.flycast:5432

  Postgres cluster still-wood-6574 is now attached to legaltserver
The following secret was added to legaltserver:
  DATABASE_URL=postgres://svenduve:HKUo6NH30JB98ni@still-wood-6574.flycast:5432/legaltserver?sslmode=disable
```


Get status of the app

```bash
➜ fly status
App
  Name     = legaltserver                                        
  Owner    = personal                                            
  Hostname = legaltserver.fly.dev                                
  Image    = legaltserver:deployment-01J7JPXV6K165HKJN8Z66TJBGJ  

Machines
PROCESS	ID            	VERSION	REGION	STATE  	ROLE	CHECKS	LAST UPDATED         
app    	148e466c136578	33     	ams   	stopped	    	      	2024-09-12T08:59:19Z	
app    	d89d970c674398	33     	ams   	stopped	    	      	2024-09-12T08:53:28Z	
```


Get the status of the postgres cluster

```bash
➜ fly postgres list
NAME           	OWNER   	STATUS  	LATEST DEPLOY 
legaltserver-db	personal	deployed	             	
```

Get the status of the current db Machines:

```bash
➜ fly status -a legaltserver-db
Updates available:

Machine "e82d921f077118" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "683016ebd556d8" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "5683076cd57598" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)

Run `flyctl image update` to migrate to the latest image version.
ID            	STATE  	ROLE   	REGION	CHECKS            	IMAGE                             	CREATED             	UPDATED              
e82d921f077118	started	replica	ams   	3 total, 3 passing	flyio/postgres-flex:15.3 (v0.0.46)	2024-01-10T10:51:38Z	2024-01-24T10:36:22Z	
683016ebd556d8	started	replica	ams   	3 total, 3 passing	flyio/postgres-flex:15.3 (v0.0.46)	2024-06-17T21:09:52Z	2024-06-17T21:10:04Z	
5683076cd57598	stopped	error  	ams   	3 total, 3 warning	flyio/postgres-flex:15.3 (v0.0.46)	2024-09-10T13:55:09Z	2024-09-12T09:01:04Z	
```


And here the list of the volumes and snapshots:

```bash
➜ fly volumes list -a legaltserver-db
ID                  	STATE  	NAME   	SIZE	REGION	ZONE	ENCRYPTED	ATTACHED VM   	CREATED AT   
vol_9vwz7p3ke3j61zqv	created	pg_data	40GB	ams   	7ef4	true     	e82d921f077118	8 months ago	
vol_vwe639l7yyp7ezqv	created	pg_data	40GB	ams   	64d9	true     	              	3 months ago	
vol_v8mzklzyqkow727r	created	pg_data	40GB	ams   	85d8	true     	683016ebd556d8	2 months ago	
vol_vxk99wz26leg8zwr	created	pg_data	40GB	ams   	92e5	true     	5683076cd57598	1 day ago   	
````

And here from the actual volumes, the snapshots:

```bash
➜ fly volumes snapshots list vol_vxk99wz26leg8zwr
Snapshots
ID                     	STATUS 	SIZE      	CREATED AT  	RETENTION DAYS 
vs_5a45Zmool2ysjXJOYaNZ	created	1152232379	19 hours ago	5             	


➜ fly volumes snapshots list vol_9vwz7p3ke3j61zqv
Snapshots
ID                        	STATUS 	SIZE     	CREATED AT  	RETENTION DAYS 
vs_zQpa3DVD0nAI35k7J72DgQB	created	989533537	19 hours ago	5             	
vs_1w8LPkxkv51hKNAMmb9qpb 	created	989533537	1 day ago   	5             	
vs_RVLP3BkBO9Rfz67mplBRLw 	created	988199047	2 days ago  	5             	
vs_wwRL3vpv25eh0Rjv2Mwk0MY	created	987937109	3 days ago  	5             	
vs_jw9XGDNDlYZhlql17oxewZX	created	987937109	4 days ago  	5             	
vs_RVLP3BkBO9RfLDMGKYkaADz	created	987675171	5 days ago  	5             	
```



```bash
➜ fly image show -a legaltserver-db
Updates available:

Machine "5683076cd57598" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "683016ebd556d8" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "e82d921f077118" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)

Run `flyctl image update` to migrate to the latest image version.
Image Details
MACHINE ID    	REGISTRY                	REPOSITORY         	TAG 	VERSION	DIGEST                                                                 	LABELS                                                                                               
5683076cd57598	registry-1.docker.io    	flyio/postgres-flex	15.3	v0.0.46	sha256:44b698752cf113110f2fa72443d7fe452b48228aafbb0d93045ef1e3282360a6	fly.version=v0.0.46fly.app_role=postgres_clusterfly.pg-manager=repmgrfly.pg-version=15.3-1.pgdg120+1	
683016ebd556d8	docker-hub-mirror.fly.io	flyio/postgres-flex	15.3	v0.0.46	sha256:44b698752cf113110f2fa72443d7fe452b48228aafbb0d93045ef1e3282360a6	fly.app_role=postgres_clusterfly.pg-manager=repmgrfly.pg-version=15.3-1.pgdg120+1fly.version=v0.0.46	
e82d921f077118	registry-1.docker.io    	flyio/postgres-flex	15.3	v0.0.46	sha256:44b698752cf113110f2fa72443d7fe452b48228aafbb0d93045ef1e3282360a6	fly.pg-version=15.3-1.pgdg120+1fly.version=v0.0.46fly.app_role=postgres_clusterfly.pg-manager=repmgr	
```

Here the command from above, building the new cluster:


```bash
➜ fly postgres create --snapshot-id vs_zQpa3DVD0nAI35k7J72DgQB --image-ref flyio/postgres-flex:15.3
? Choose an app name (leave blank to generate one): 
? Select Organization: Sven Duve (personal)
Some regions require a Launch plan or higher (bom, fra).
See https://fly.io/plans to set up a plan.

? Select region: Amsterdam, Netherlands (ams)
? Select configuration: Production (High Availability) - 3 nodes, 2x shared CPUs, 4GB RAM, 40GB disk
Creating postgres cluster in organization personal
Creating app...
Setting secrets on app still-wood-6574...
Restoring 1 of 3 machines with image flyio/postgres-flex:15.3
Waiting for machine to start...
Machine 9185e99dc33283 is created
Restoring 2 of 3 machines with image flyio/postgres-flex:15.3
Waiting for machine to start...
Machine 3d8dd333a3d389 is created
Restoring 3 of 3 machines with image flyio/postgres-flex:15.3
Waiting for machine to start...
Machine 1781597df14489 is created
==> Monitoring health checks
  Waiting for 9185e99dc33283 to become healthy (started, 3/3)
  Waiting for 3d8dd333a3d389 to become healthy (started, 3/3)
  Waiting for 1781597df14489 to become healthy (started, 3/3)

Postgres cluster still-wood-6574 created
  Username:    postgres
  Password:    c0AKZUmSA6HdVsM
  Hostname:    still-wood-6574.internal
  Flycast:     fdaa:3:161a:0:1::5
  Proxy port:  5432
  Postgres port:  5433
  Connection string: postgres://postgres:c0AKZUmSA6HdVsM@still-wood-6574.flycast:5432

Save your credentials in a secure place -- you won't be able to see them again!

Connect to postgres
Any app within the Sven Duve organization can connect to this Postgres using the above connection string

Now that you've set up Postgres, here's what you need to understand: https://fly.io/docs/postgres/getting-started/what-you-should-know/
````

Now these failed, not sure why:

```bash
➜ fly postgres detach legaltserver-db
Error: no active leader found
```

Here I tried to attach it again, but it failed, because legaltserver was already attached to the db:
```bash
➜ fly postgres attach still-wood-6574
Checking for existing attachments
Error: consumer app "legaltserver" already contains a secret named DATABASE_URL
```

```bash
➜ fly postgres attach still-wood-6574
Checking for existing attachments
? Database "legaltserver" already exists. Continue with the attachment process? Yes
Error: database user "legaltserver" already exists. Please specify a new database user via --database-user
```

```bash
➜ fly postgres list
NAME           	OWNER   	STATUS  	LATEST DEPLOY 
legaltserver-db	personal	deployed	             	
still-wood-6574	personal	deployed	             	
```

```bash
➜ fly postgres detach legaltserver-db
Error: no active leader found
```
I think leader does mean actually a leading machine and not the replicas...

Doesnt work in an app directory, unclear to me how to perfrom this from the command line...
```bash
➜ fly postgres failover
Error: app legaltserver is not a Postgres app
```

```bash
➜ fly postgres failover legaltserver-db
Error: app legaltserver is not a Postgres app
```

updating did not do the job

```bash
➜ fly status -a legaltserver-db
Updates available:

Machine "e82d921f077118" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "683016ebd556d8" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "5683076cd57598" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)

Run `flyctl image update` to migrate to the latest image version.
ID            	STATE  	ROLE   	REGION	CHECKS            	IMAGE                             	CREATED             	UPDATED              
e82d921f077118	started	replica	ams   	3 total, 3 passing	flyio/postgres-flex:15.3 (v0.0.46)	2024-01-10T10:51:38Z	2024-01-24T10:36:22Z	
683016ebd556d8	started	replica	ams   	3 total, 3 passing	flyio/postgres-flex:15.3 (v0.0.46)	2024-06-17T21:09:52Z	2024-06-17T21:10:04Z	
5683076cd57598	stopped	error  	ams   	3 total, 3 warning	flyio/postgres-flex:15.3 (v0.0.46)	2024-09-10T13:55:09Z	2024-09-12T09:39:33Z	


legaltserver on  main [!] is 📦 1.0.0 via ⬢ v21.5.0 using ☁️  default/revovet-331615 via 🅒 base took 2,1s 
➜ flyctl image update
Configuration changes to be applied to machine: 148e466c136578 (rough-grass-4149)

  	... // 42 identical lines
  	    }
  	  ],
- 	  "image": "registry.fly.io/legaltserver:deployment-01J7JPXV6K165HKJN8Z66TJBGJ"
+ 	  "image": "registry.fly.io/legaltserver:deployment-01J7JPXV6K165HKJN8Z66TJBGJ@sha256:582b708a65fea36c39716c54b97d4fc76996428bd8cf58bb89ca09ac8e018a79"
  	}
  	
? Apply changes? Yes
Configuration changes to be applied to machine: d89d970c674398 (delicate-haze-9200)

  	... // 42 identical lines
  	    }
  	  ],
- 	  "image": "registry.fly.io/legaltserver:deployment-01J7JPXV6K165HKJN8Z66TJBGJ"
+ 	  "image": "registry.fly.io/legaltserver:deployment-01J7JPXV6K165HKJN8Z66TJBGJ@sha256:582b708a65fea36c39716c54b97d4fc76996428bd8cf58bb89ca09ac8e018a79"
  	}
  	
? Apply changes? Yes
Updating machine d89d970c674398
No health checks found
Machine d89d970c674398 updated successfully!
Updating machine 148e466c136578
No health checks found
Machine 148e466c136578 updated successfully!
Machines successfully updated

legaltserver on  main [!] is 📦 1.0.0 via ⬢ v21.5.0 using ☁️  default/revovet-331615 via 🅒 base took 29,3s 
➜ fly status -a legaltserver-db
Updates available:

Machine "e82d921f077118" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "683016ebd556d8" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)
Machine "5683076cd57598" flyio/postgres-flex:15.3 (v0.0.46) -> flyio/postgres-flex:15.8 (v0.0.62)

Run `flyctl image update` to migrate to the latest image version.
ID            	STATE  	ROLE   	REGION	CHECKS            	IMAGE                             	CREATED             	UPDATED              
e82d921f077118	started	replica	ams   	3 total, 3 passing	flyio/postgres-flex:15.3 (v0.0.46)	2024-01-10T10:51:38Z	2024-01-24T10:36:22Z	
683016ebd556d8	started	replica	ams   	3 total, 3 passing	flyio/postgres-flex:15.3 (v0.0.46)	2024-06-17T21:09:52Z	2024-06-17T21:10:04Z	
5683076cd57598	stopped	error  	ams   	3 total, 3 warning	flyio/postgres-flex:15.3 (v0.0.46)	2024-09-10T13:55:09Z	2024-09-12T09:41:40Z	
```

failed attempts on failover or detaching:
```bash

➜ fly postgres failover e82d921f077118 legaltserver-db
Error: app legaltserver is not a Postgres app


➜ fly postgres detach legaltserver-db --app legaltserver
Error: no active leader found


➜ fly postgres users list --app legaltserver       
Error: app legaltserver is not a postgres app


➜ fly postgres users list --app legaltserver-db
Error: no active leader found



Trying to reattach the db to the app:

```bash

➜ fly postgres attach legaltserver-db --app legaltserver
Error: no active leader found
```

This seems to change something

```bash
➜ fly postgres attach still-wood-6574 --app legaltserver
Checking for existing attachments
? Database "legaltserver" already exists. Continue with the attachment process? Yes
Error: database user "legaltserver" already exists. Please specify a new database user via --database-user


➜ fly postgres attach still-wood-6574 --database-user svenduve     
Checking for existing attachments
? Database "legaltserver" already exists. Continue with the attachment process? Yes
Registering attachment
Creating user

Postgres cluster still-wood-6574 is now attached to legaltserver
The following secret was added to legaltserver:
  DATABASE_URL=postgres://svenduve:HKUo6NH30JB98ni@still-wood-6574.flycast:5432/legaltserver?sslmode=disable
```

re -deploying


```bash
➜ fly deploy
==> Verifying app config
Validating /Users/svenduve/localGithub/legaltserver/fly.toml
✓ Configuration is valid
--> Verified app config
==> Building image
Remote builder fly-builder-black-dew-9168 ready
Remote builder fly-builder-black-dew-9168 ready
==> Building image with Docker
--> docker host: 24.0.7 linux x86_64
[+] Building 1.2s (10/10) FINISHED                                                                                                                                                                                                  
 => [internal] load build definition from Dockerfile                                                                                                                                                                           0.3s
 => => transferring dockerfile: 228B                                                                                                                                                                                           0.3s
 => [internal] load .dockerignore                                                                                                                                                                                              0.3s
 => => transferring context: 1.53kB                                                                                                                                                                                            0.3s
 => [internal] load metadata for docker.io/library/node:14                                                                                                                                                                     0.6s
 => [1/5] FROM docker.io/library/node:14@sha256:a158d3b9b4e3fa813fa6c8c590b8f0a860e015ad4e59bbce5744d2f6fd8461aa                                                                                                               0.0s
 => [internal] load build context                                                                                                                                                                                              0.2s
 => => transferring context: 18.04kB                                                                                                                                                                                           0.2s
 => CACHED [2/5] WORKDIR /usr/src/app                                                                                                                                                                                          0.0s
 => CACHED [3/5] COPY package*.json ./                                                                                                                                                                                         0.0s
 => CACHED [4/5] RUN npm install                                                                                                                                                                                               0.0s
 => [5/5] COPY . .                                                                                                                                                                                                             0.1s
 => exporting to image                                                                                                                                                                                                         0.0s
 => => exporting layers                                                                                                                                                                                                        0.0s
 => => writing image sha256:12452eeef4d38e10ce6131667b857949e8defa022796ddb0e3cbcd6e9bdb7d5f                                                                                                                                   0.0s
 => => naming to registry.fly.io/legaltserver:deployment-01J7JTBYD9AZHJ592KNWTJC5HZ                                                                                                                                            0.0s
--> Building image done
==> Pushing image to fly
The push refers to repository [registry.fly.io/legaltserver]
4d5be3f05053: Pushed 
41aa3dbb830b: Layer already exists 
6235aef962e5: Layer already exists 
8d7098901273: Layer already exists 
0d5f5a015e5d: Layer already exists 
3c777d951de2: Layer already exists 
f8a91dd5fc84: Layer already exists 
cb81227abde5: Layer already exists 
e01a454893a9: Layer already exists 
c45660adde37: Layer already exists 
fe0fb3ab4a0f: Layer already exists 
f1186e5061f2: Layer already exists 
b2dba7477754: Layer already exists 
deployment-01J7JTBYD9AZHJ592KNWTJC5HZ: digest: sha256:7510b64af57d9a6579cc569f131f4afaab900cd8a02b20d2309b20ef80472e3e size: 3053
--> Pushing image done
image: registry.fly.io/legaltserver:deployment-01J7JTBYD9AZHJ592KNWTJC5HZ
image size: 951 MB

Watch your deployment at https://fly.io/apps/legaltserver/monitoring

-------
Updating existing machines in 'legaltserver' with rolling strategy

-------
 ✔ [1/2] Cleared lease for d89d970c674398
 ✔ [2/2] Cleared lease for 148e466c136578
-------
Checking DNS configuration for legaltserver.fly.dev

Visit your newly deployed app at https://legaltserver.fly.dev/
````

Old database dead:

```bash
➜ fly postgres users list --app legaltserver-db
Error: no active leader found
```


But the copy works:

```bash
➜ fly postgres users list --app still-wood-6574
NAME        	SUPERUSER	DATABASES                      
flypgadmin  	yes      	legaltserver, postgres, repmgr	
legaltserver	yes      	legaltserver, postgres, repmgr	
postgres    	yes      	legaltserver, postgres, repmgr	
repmgr      	yes      	legaltserver, postgres, repmgr	
svenduve    	yes      	legaltserver, postgres, repmgr	
```