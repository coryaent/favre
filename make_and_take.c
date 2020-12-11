#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>

int main() { 

	seteuid (0);
	setegid (0);

	if ( mkdir("/run/my-dir", 0755) || 
		 chown("/run/my-dir", getuid(), getgid()) ||
		 chown("/sync", getuid(), getgid()) ) { exit (EXIT_FAILURE); }

	exit (EXIT_SUCCESS);

}
