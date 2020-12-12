#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>

int main() { 

	seteuid (0);
	setegid (0);

	if ( mkdir("/run/csync2", 0755) || 
		 mkdir("/run/csync2/db", 0755) || 
		 chown("/run/csync2/db", getuid(), getgid()) ||
		 chown("/run/csync2", getuid(), getgid()) ||
		 chown("/sync", getuid(), getgid()) ) { exit (EXIT_FAILURE); }

	exit (EXIT_SUCCESS);

}
