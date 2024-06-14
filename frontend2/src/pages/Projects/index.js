import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import TableHeader from 'components/TableHeader';
import Button from 'components/Button';
import DataGrid from 'components/DataGrid';
import global from 'styles/global';
import { getProjects, projectsSelector } from 'slices/projects';
import { setHeaderData } from 'slices/misc';

export default function Projects() {
  const dispatch = useDispatch();
  const g = global();
  const history = useHistory();

  const { data: projects } = useSelector(projectsSelector);
  const columns = [
    {
      field: 'id',
      headerName: 'ID',
      flex: 1,
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1,
    },
  ];

  useEffect(() => {
    dispatch(getProjects());
    dispatch(
      setHeaderData({
        title: 'Projects',
        breadcrumbs: [{ label: 'Projects' }],
      })
    );
  }, []);

  return (
    <div>
      <TableHeader title="Projects">
        <div>
          <Button
            size="small"
            variant="contained"
            className={g.ml_xs}
            color="primary"
            onClick={() => history.push('/projects/new')}
          >
            New Project
          </Button>
        </div>
      </TableHeader>
      <DataGrid autoHeight autoPageSize rows={projects} columns={columns} />
    </div>
  );
}
